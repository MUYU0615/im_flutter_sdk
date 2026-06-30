# REST User Provisioning

## Purpose

REST user tools create and delete temporary accounts for SDK tests. They are setup and cleanup helpers only. They do not prove SDK API coverage.

## Prerequisites

Configure `config.yaml` with:

- `rest_api.base_url`
- `rest_api.app_key`
- `rest_api.auth_token`, or `rest_api.client_id` and `rest_api.client_secret`

Use the app key provided by the user or environment. Do not invent or replace app keys.

## Quick Commands

Create users:

```bash
skills/im-rest-users/scripts/create_users.py --user u1 u2
```

Create from JSON:

```bash
skills/im-rest-users/scripts/create_users.py --from-file users.json
```

Delete a user:

```bash
skills/im-rest-users/scripts/delete_user.py --username u1
```

## Rules

- Use REST to prepare users, groups, rooms, or server state when SDK setup would make the case unstable or too slow.
- Verify the target SDK behavior through SDK calls and observable state.
- Clean up temporary users and resources when the case creates them.

## References

- `src/rest_api/user_api.py`
