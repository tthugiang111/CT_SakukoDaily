import re

server_path = '/home/node/.openclaw/workspace/projects/WebTheNBT/server.js'
with open(server_path, 'r', encoding='utf-8') as f:
    code = f.read()

# Thêm route rewrite /admin -> admin.html sạch sẽ
clean_admin_route = """
// Route sạch không đuôi cho Cổng Quản Trị Admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
"""

if "app.get('/admin'," not in code:
    code = code.replace("app.use(express.static(path.join(__dirname, 'public')));", 
                        "app.use(express.static(path.join(__dirname, 'public')));\n" + clean_admin_route)
    with open(server_path, 'w', encoding='utf-8') as f:
        f.write(code)
    print("Added clean /admin route to server.js")
else:
    print("Route already exists")
