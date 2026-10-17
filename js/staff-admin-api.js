(function () {
  'use strict';
  const PAGE_SIZE = 500;
  let client, actor;
  const master = () => actor?.role === 'master_admin';
  const defaults = { applications: true, support: true, updates: true, institutions: false, accommodation: true, cv: true, jobs: true, publish_jobs: false };
  const check = (result, label) => {
    if (result?.error) throw new Error(`${label}: ${result.error.message || 'Request failed'}`);
    return result?.data;
  };
  async function authenticate(role) {
    const api = window.KagieAPI;
    if (!api) throw new Error('Kagie account services could not load. Refresh to try again.');
    await api.restoreSession();
    client = api.initSupabaseClient();
    if (!client) throw new Error('Live account services are unavailable. Check the Supabase configuration.');
    const auth = await client.auth.getUser();
    if (auth.error && (auth.error.name === 'AuthSessionMissingError' || [401, 403].includes(auth.error.status))) {
      const error = new Error('Please sign in to your staff account.'); error.signIn = true; throw error;
    }
    const verified = check(auth, 'Check session')?.user;
    if (!verified) { const error = new Error('Please sign in to your staff account.'); error.signIn = true; throw error; }
    const profile = check(await client.from('profiles').select('id,full_name,email,phone,role').eq('id', verified.id).single(), 'Check staff access');
    if (profile.role !== role) { const error = new Error('This page is restricted to the correct staff role.'); error.signIn = true; throw error; }
    actor = profile;
    return actor;
  }
  async function list(table, filters = {}, order = 'created_at', columns = '*') {
    if (!actor) throw new Error('Sign in before loading staff records.');
    const rows = [];
    for (let start = 0; ; start += PAGE_SIZE) {
      let query = client.from(table).select(columns);
      Object.entries(filters).forEach(([key, value]) => { query = Array.isArray(value) ? query.in(key, value) : query.eq(key, value); });
      if (order) query = query.order(order, { ascending: false });
      const batch = check(await query.range(start, start + PAGE_SIZE - 1), `Load ${table}`) || [];
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) return rows;
    }
  }
  async function save(table, data, id) {
    if (!actor) throw new Error('Your staff session has expired.');
    const staffTables = ['applications', 'cv_requests', 'support_threads', 'support_messages', 'document_reviews', 'documents', 'callback_requests', 'accommodation_requests', 'application_updates', 'application_notes', 'assistant_activity', 'notifications'];
    const masterTables = ['institutions', 'question_papers', 'announcements', 'admin_content'];
    const contentTables = ['career_articles', 'housing_listings'];
    if (!staffTables.includes(table) && !(master() && masterTables.includes(table)) && !contentTables.includes(table) && !(table === 'institutions' && await serviceEnabled('institutions'))) throw new Error('You cannot change this module.');
    const payload = { ...data };
    if (contentTables.includes(table)) {
      if (!master()) {
        if (!await serviceEnabled(table === 'career_articles' ? 'jobs' : 'accommodation')) throw new Error('Master Admin has not granted access to this service.');
        let current;
        if (id) {
          current = check(await client.from(table).select('*').eq('id', id).single(), 'Check draft');
          if (table === 'career_articles' && (current.created_by !== actor.id || current.approval_state === 'submitted' || current.status !== 'draft' && !await serviceEnabled('publish_jobs') && !(payload.status==='draft'&&await serviceEnabled('jobs_unpublish')))) throw new Error('Only editable opportunities belonging to your account can be changed.');
          if (table === 'housing_listings' && current.created_by !== actor.id && current.assigned_assistant_id !== actor.id) throw new Error('Only your own or assigned listings can be changed.');
        }
        if (table === 'career_articles' && !['job', 'internship'].includes(payload.content_type||current?.content_type)) throw new Error('Assistants can submit job and internship drafts.');
        if (table === 'career_articles') {
          const canPublish = await serviceEnabled('publish_jobs');
          if (payload.status === 'published' && !canPublish) throw new Error('Master Admin approval is required to publish.');
          payload.status ||= 'draft';
        }
        else { if (payload.listing_state && payload.listing_state !== current?.listing_state && (payload.listing_state==='published'||current?.listing_state==='published') && !await serviceEnabled('housing_publish')) throw new Error('Housing publication is locked.'); payload.listing_state ||= current?.listing_state||'draft'; payload.is_active = current?.is_active??true; }
      }
      payload.updated_by = actor.id;
      if (!id) payload.created_by = actor.id;
    }
    let query = client.from(table);
    query = id ? query.update(payload).eq('id', id) : query.insert(payload);
    const row = check(await query.select('*').single(), `Save ${table}`);
    if (!row?.id) throw new Error('The server did not confirm the save.');
    return row;
  }
  async function archive(table, id) {
    if (!master()) throw new Error('Only Master Admin can archive content.');
    const field = table === 'housing_listings' ? 'listing_state' : 'status';
    return save(table, { [field]: 'archived' }, id);
  }
  async function permissions(id, values) {
    if (!master()) throw new Error('Only Master Admin can change form access.');
    const rows = values.map(item => ({ assistant_admin_id: id, form_type: item.form_type, enabled: item.enabled, granted_by: actor.id, granted_at: new Date().toISOString() }));
    return check(await client.from('assistant_form_permissions').upsert(rows, { onConflict: 'assistant_admin_id,form_type' }).select('*'), 'Save form access');
  }
  async function serviceEnabled(key) {
    if (master()) return true;
    const row = check(await client.from('assistant_service_permissions').select('enabled').eq('assistant_admin_id', actor.id).eq('service_key', key).maybeSingle(), 'Check service access');
    const parent = key==='publish_jobs'?'jobs':key.startsWith('housing_') ? 'accommodation' : key.startsWith('cv_') ? 'cv' : key.startsWith('jobs_') ? 'jobs' : key;
      const value = row?.enabled === true;
    return value && (parent === key || await serviceEnabled(parent));
  }
  async function servicePermissions(id, values) {
    if (!master()) throw new Error('Only Master Admin can change service access.');
    const payload = values.map(item => ({ assistant_admin_id: id, service_key: item.service_key, enabled: item.enabled, granted_by: actor.id }));
    return check(await client.from('assistant_service_permissions').upsert(payload, { onConflict: 'assistant_admin_id,service_key' }).select('*'), 'Save service access');
  }
  async function documentUrl(path) {
    if (!path) throw new Error('No file was attached to this record.');
    if (/^https?:\/\//i.test(path)) return path;
    const signed = check(await client.storage.from('kagie-documents').createSignedUrl(path, 600), 'Open file');
    if (!signed?.signedUrl) throw new Error('Could not open this private file.');
    return signed.signedUrl;
  }
  async function validateImage(file) {
    if (!file || !/\.(jpe?g|png|webp)$/i.test(file.name) || !/^image\/(jpeg|png|webp)$/i.test(file.type) || !file.size || file.size > 8 * 1024 * 1024) throw new Error('Choose a JPG, PNG or WEBP image up to 8 MB.');
    try { const decoded = await createImageBitmap(file); if (!decoded.width || !decoded.height) throw new Error(); decoded.close(); } catch { throw new Error('This image could not be decoded. Choose a valid picture.'); }
    return file;
  }
  async function upload(file, folder, image = false) {
    if (image) await validateImage(file);
    const allowed = image ? /^image\/(jpeg|png|webp)$/i : /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/i;
    const extension = String(file?.name || '').split('.').pop().toLowerCase();
    const extensions = image ? ['jpg', 'jpeg', 'png', 'webp'] : ['pdf', 'doc', 'docx'];
    if (!file || !extensions.includes(extension) || (file.type && !allowed.test(file.type)) || file.size > 8 * 1024 * 1024 || !file.size) throw new Error(image ? 'Choose a JPG, PNG or WEBP image up to 8 MB.' : 'Choose a PDF, DOC or DOCX file up to 8 MB.');
    const path = `${folder}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    check(await client.storage.from('kagie-documents').upload(path, file, { contentType: file.type || undefined, upsert: false }), 'Upload file');
    return path;
  }
  async function reviseCv(doc, file) {
    if (!await serviceEnabled('cv')) throw new Error('Master Admin has not granted CV service access.');
    const request=(await list('cv_requests',{source_document_id:doc.id}))[0];
    if(!request)throw new Error('No assigned CV request is linked to this document.');
    const path = await upload(file, doc.user_id);
    try {
      return await save('documents', { user_id: doc.user_id, application_id: doc.application_id || null, document_type: 'cv_revised', file_name: file.name, file_url: path, file_size: file.size, mime_type: file.type, status: 'Approved',metadata:{cvRequestId:request.id} });
    } catch (error) {
      await client.storage.from('kagie-documents').remove([path]);
      throw error;
    }
  }
  async function notify(userId, title, message) {
    return save('notifications', { user_id: userId, title, message, notification_type: 'info' });
  }
  async function reply(ticket, message) {
    const row = await save('support_messages', { thread_id: ticket.id, sender_id: actor.id, sender_role: actor.role, message });
    // A delivered reply remains successful if updating the ticket recency fails.
    try { await save('support_threads', { status: 'awaiting_user', last_message_at: row.created_at }, ticket.id); } catch (error) { console.warn(error); }
    return row;
  }
  async function legacyWrite(method, args, table, id, expected) {
    if (!master()) throw new Error('This action requires Master Admin.');
    const result = await window.KagieAPI[method](...args);
    const saved = check(await client.from(table).select('*').eq('id', id).single(), 'Confirm saved record');
    if (Object.entries(expected).some(([key, value]) => saved[key] !== value)) throw new Error('The live server did not confirm this change. Refresh and try again.');
    return result;
  }
  async function rpc(name, args) { return check(await client.rpc(name, args), 'Save staff action'); }
  async function get(table, id) { const result = (await list(table, { id }, null))[0]; if (!result) throw new Error('Record unavailable or access denied.'); return result; }
  window.KagieStaffData = { authenticate, list, get, rpc, save, archive, permissions, servicePermissions, documentUrl, upload, validateImage, reviseCv, notify, reply, legacyWrite, get actor() { return actor; } };
})();
