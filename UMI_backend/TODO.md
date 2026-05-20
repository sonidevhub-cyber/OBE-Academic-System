# TODO

- [ ] Fix Django URL import error: `No module named 'core.urls.auth'; 'core.urls' is not a package`
  - [ ] Rename `umi_backend/core/urls.py` → `umi_backend/core/root_urls.py`
  - [ ] Update includes/imports that reference `core.urls` to use `core.root_urls`
  - [ ] Re-run `python manage.py runserver` (or system checks)
- [ ] Verify auth endpoints work

