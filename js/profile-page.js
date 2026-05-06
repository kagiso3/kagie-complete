(() => {
  const api = window.KagieAPI;
  if (!api) return;

  const user = api.requireRole("user");
  const profile = api.getProfile(user.id) || {};
  const docs = api.getDocumentsByUser(user.id) || [];
  const apps = api.getApplicationsByUser(user.id) || [];
  const data = window.KagieData || {};
  const $ = (id) => document.getElementById(id);

  const refs = {
    timeNow: $("timeNow"),
    heroTitle: $("heroTitle"),
    heroText: $("heroText"),
    docMeta: $("docMeta"),
    appMeta: $("appMeta"),
    avatar: $("avatar"),
    avatarFile: $("avatarFile"),
    removePhotoBtn: $("removePhotoBtn"),
    displayName: $("displayName"),
    displayEmail: $("displayEmail"),
    docCount: $("docCount"),
    appCount: $("appCount"),
    fullName: $("fullName"),
    email: $("email"),
    phone: $("phone"),
    province: $("province"),
    idNumber: $("idNumber"),
    dob: $("dob"),
    gender: $("gender"),
    homeLanguage: $("homeLanguage"),
    address: $("address"),
    schoolName: $("schoolName"),
    saveBtn: $("saveBtn"),
    profileMsg: $("profileMsg"),
    docs: $("docs"),
    shareAppBtn: $("shareAppBtn"),
    yearNow: $("yearNow")
  };

  const DEFAULT_AVATAR = "data:image/svg+xml;utf8," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><circle cx='60' cy='60' r='60' fill='#d9dee6'/><circle cx='60' cy='45' r='22' fill='#ffffff' fill-opacity='0.96'/><path d='M22 98c5-18 22-28 38-28s33 10 38 28' fill='#ffffff' fill-opacity='0.96'/></svg>"
  );
  const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

  function firstName(name) {
    return (name || "Student").trim().split(/\s+/)[0] || "Student";
  }

  function fillSelect(element, items, selected) {
    if (!element) return;
    element.innerHTML =
      "<option value=''>Select</option>" +
      items
        .map((item) => `<option value="${item}" ${item === selected ? "selected" : ""}>${item}</option>`)
        .join("");
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result || "");
      reader.onerror = () => reject(new Error("Could not read image."));
      reader.readAsDataURL(file);
    });
  }

  function setMessage(text, type) {
    refs.profileMsg.textContent = text || "";
    refs.profileMsg.className = type ? `status-note ${type}` : "status-note";
  }

  function setBusy(button, label, busy) {
    if (!button) return;
    button.disabled = !!busy;
    if (label) button.textContent = label;
  }

  function getPhoto() {
    return (
      api.getSharedProfilePhoto() ||
      profile.profileImage ||
      localStorage.getItem("kagie_profile_photo") ||
      localStorage.getItem("kagieProfileImage") ||
      localStorage.getItem("kagie_profile_avatar_v1") ||
      DEFAULT_AVATAR
    );
  }

  function renderDocs() {
    if (!docs.length) {
      refs.docs.innerHTML = "<div class='empty'>No documents uploaded yet.</div>";
      return;
    }

    refs.docs.innerHTML = docs
      .slice(0, 6)
      .map(
        (doc) => `
          <div class="doc-card">
            <strong>${doc.name || "Document"}</strong>
            <p>Category: ${doc.category || "-"}<br>Status: ${doc.status || "Pending review"}</p>
          </div>
        `
      )
      .join("");
  }

  function renderSummary() {
    const fullName = refs.fullName.value.trim() || profile.fullName || user.fullName || "Student";
    const email = refs.email.value.trim() || profile.email || user.email || "No email added";

    refs.displayName.textContent = fullName;
    refs.displayEmail.textContent = email;
    refs.heroTitle.textContent = `Hello, ${firstName(fullName)}`;
    refs.heroText.textContent = "Keep your profile updated once and Kagie can carry the same details across forms, documents, and updates.";
    refs.docMeta.textContent = `${docs.length} document${docs.length === 1 ? "" : "s"} ready`;
    refs.appMeta.textContent = `${apps.length} application${apps.length === 1 ? "" : "s"} linked`;
    refs.docCount.textContent = String(docs.length).padStart(2, "0");
    refs.appCount.textContent = String(apps.length).padStart(2, "0");
  }

  function savePhotoToStorage(value) {
    if (value) {
      localStorage.setItem("kagie_profile_photo", value);
      localStorage.setItem("kagieProfileImage", value);
      localStorage.setItem("kagie_profile_avatar_v1", value);
      return;
    }

    localStorage.removeItem("kagie_profile_photo");
    localStorage.removeItem("kagieProfileImage");
    localStorage.removeItem("kagie_profile_avatar_v1");
  }

  fillSelect(refs.province, data.provinces || [], profile.province || "");
  fillSelect(refs.gender, data.genders || [], profile.gender || "");
  fillSelect(refs.homeLanguage, data.homeLanguages || [], profile.homeLanguage || "");

  refs.fullName.value = profile.fullName || user.fullName || "";
  refs.email.value = profile.email || user.email || "";
  refs.phone.value = profile.phone || user.phone || "";
  refs.idNumber.value = profile.idNumber || "";
  refs.dob.value = profile.dob || "";
  refs.address.value = profile.address || profile.homeAddress || "";
  refs.schoolName.value = profile.schoolName || profile.schoolAttended || "";
  refs.avatar.src = getPhoto();

  if (refs.timeNow) {
    refs.timeNow.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  if (refs.yearNow) {
    refs.yearNow.textContent = String(new Date().getFullYear());
  }

  renderSummary();
  renderDocs();

  refs.avatarFile.addEventListener("change", async () => {
    const file = refs.avatarFile.files[0];
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      setMessage("Choose JPG, PNG, or another image file for the profile picture.", "err");
      refs.avatarFile.value = "";
      return;
    }
    if (Number(file.size || 0) > MAX_AVATAR_BYTES) {
      setMessage("Keep the profile image under 4 MB so Kagie can save it smoothly.", "err");
      refs.avatarFile.value = "";
      return;
    }

    try {
      setBusy(refs.removePhotoBtn, "Saving photo...", true);
      setMessage("Uploading profile photo...", "ok");
      const dataUrl = await readFile(file);
      if (api.saveProfileAsync) await api.saveProfileAsync(user.id, { profileImage: dataUrl });
      else api.saveProfile(user.id, { profileImage: dataUrl });
      refs.avatar.src = dataUrl;
      savePhotoToStorage(dataUrl);
      setMessage("Profile photo updated.", "ok");
    } catch (error) {
      setMessage(error.message || "Image upload failed.", "err");
    } finally {
      setBusy(refs.removePhotoBtn, "Remove photo", false);
    }
  });

  refs.removePhotoBtn.addEventListener("click", async () => {
    try {
      setBusy(refs.removePhotoBtn, "Removing photo...", true);
      if (api.saveProfileAsync) await api.saveProfileAsync(user.id, { profileImage: "" });
      else api.saveProfile(user.id, { profileImage: "" });
      refs.avatar.src = DEFAULT_AVATAR;
      savePhotoToStorage("");
      setMessage("Profile photo removed.", "ok");
    } catch (error) {
      setMessage(error.message || "Could not remove the profile photo.", "err");
    } finally {
      setBusy(refs.removePhotoBtn, "Remove photo", false);
    }
  });

  refs.saveBtn.addEventListener("click", async () => {
    try {
      setBusy(refs.saveBtn, "Saving...", true);
      setMessage("Saving your profile...", "ok");
      const payload = {
        fullName: refs.fullName.value.trim(),
        email: refs.email.value.trim(),
        phone: refs.phone.value.trim(),
        province: refs.province.value,
        idNumber: refs.idNumber.value.trim(),
        dob: refs.dob.value,
        gender: refs.gender.value,
        homeLanguage: refs.homeLanguage.value,
        address: refs.address.value.trim(),
        homeAddress: refs.address.value.trim(),
        schoolName: refs.schoolName.value.trim(),
        schoolAttended: refs.schoolName.value.trim()
      };

      if (api.saveProfileAsync) await api.saveProfileAsync(user.id, payload);
      else api.saveProfile(user.id, payload);
      Object.assign(profile, payload);
      renderSummary();
      setMessage("Profile updated successfully.", "ok");
    } catch (error) {
      setMessage(error.message || "Could not save profile.", "err");
    } finally {
      setBusy(refs.saveBtn, "Save profile", false);
    }
  });

  refs.shareAppBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    const shareData = {
      title: "Kagie App",
      text: "Apply to tertiary institutions easily with Kagie.",
      url: window.location.origin
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setMessage("Kagie shared successfully.", "ok");
      } catch (error) {
        setMessage("", "");
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareData.url);
      setMessage("App link copied to clipboard.", "ok");
    } catch (error) {
      setMessage("Unable to share right now.", "err");
    }
  });
})();
