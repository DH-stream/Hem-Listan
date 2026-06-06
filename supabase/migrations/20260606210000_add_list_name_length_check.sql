alter table public.hl_lists
  add constraint hl_lists_name_length_check
  check (char_length(trim(name)) between 1 and 80);
