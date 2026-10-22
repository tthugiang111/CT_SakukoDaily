with open('/home/node/.openclaw/workspace/projects/WebTheNBT/server.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace the literal ellipsis string
old_str_1 = "'Authorization': `Bearer ${appD\u2026oken}`"
new_str_1 = "'Authorization': `Bearer ${appData.app_access_token}`"
old_str_2 = "'Authorization': `Bearer ${toke\u2026oken}`"
new_str_2 = "'Authorization': `Bearer ${tokenData.data.access_token}`"

code = code.replace(old_str_1, new_str_1)
code = code.replace(old_str_2, new_str_2)

with open('/home/node/.openclaw/workspace/projects/WebTheNBT/server.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Replaced successfully!")
