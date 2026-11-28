insert into public.platform_admins (user_id, role)
select id, 'super_admin'
from auth.users
where email = 'birukchali86@gmail.com'
on conflict (user_id) do update set role = excluded.role;