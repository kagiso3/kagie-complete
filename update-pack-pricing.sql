insert into public.application_packs (code, name, price, institution_limit, is_unlimited, description, highlight)
values
  ('launch', '10 Institution Pack', 250, 10, false, 'Apply to up to 10 institutions with guided form completion, shortlist support, and Kagie tracking in one place.', 'Best value for a strong first shortlist'),
  ('growth', '15 Institution Pack', 350, 15, false, 'Apply to up to 15 universities, colleges, and TVET institutions while keeping your draft, documents, and support aligned.', 'Balanced choice for wider national coverage'),
  ('premium', '20 Institution Pack', 450, 20, false, 'Apply to up to 20 institutions with broader coverage, stronger planning room, and premium Kagie guidance.', 'Built for ambitious applicants targeting many options'),
  ('concierge', 'Unlimited Pack', 800, null, true, 'Apply to as many institutions as you need with unlimited shortlist coverage and close Kagie support across the cycle.', 'Maximum reach with full Kagie support')
on conflict (code) do update
set
  name = excluded.name,
  price = excluded.price,
  institution_limit = excluded.institution_limit,
  is_unlimited = excluded.is_unlimited,
  description = excluded.description,
  highlight = excluded.highlight,
  updated_at = timezone('utc', now());
