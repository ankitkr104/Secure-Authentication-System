const fs = require('fs');
const path = require('path');

async function runSeed() {
    console.log("Seeding Database via API...");

    const users = [
        { name: "Alice", email: "alice@example.com", password: "password123" },
        { name: "Bob", email: "bob@example.com", password: "password123" },
        { name: "Charlie", email: "charlie@example.com", password: "password123" }
    ];

    const tokens = {};
    const files = {};

    // Create a dummy file to upload
    const dummyFilePath = path.join(__dirname, 'dummy.txt');
    fs.writeFileSync(dummyFilePath, 'Hello World!');

    for (const u of users) {
        // Register
        let res = await fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(u)
        });
        if (res.status === 400) {
            console.log(`User ${u.name} already exists.`);
        } else {
            console.log(`Registered ${u.name}`);
        }

        // Login
        res = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: u.email, password: u.password })
        });
        const data = await res.json();
        tokens[u.name] = data.token;
        console.log(`Logged in ${u.name}, token: ${data.token}`);

        // Upload a file
        const formData = new FormData();
        formData.append('file', new Blob([fs.readFileSync(dummyFilePath)]), 'dummy.txt');
        
        res = await fetch('http://localhost:3000/api/files', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${data.token}` },
            body: formData
        });
        const fileData = await res.json();
        files[u.name] = fileData.id;
        console.log(`Uploaded file for ${u.name}, fileId: ${fileData.id}`);
    }

    // Verify isolation
    console.log("\nVerifying Isolation...");
    
    // Alice tries to read Bob's file
    let res = await fetch(`http://localhost:3000/api/files/${files['Bob']}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokens['Alice']}` }
    });
    console.log(`Alice accessing Bob's file: Status ${res.status}`);
    
    // Alice tries to read Alice's file
    res = await fetch(`http://localhost:3000/api/files/${files['Alice']}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokens['Alice']}` }
    });
    console.log(`Alice accessing Alice's file: Status ${res.status}`);

    fs.unlinkSync(dummyFilePath);
    console.log("Seeding and Verification Complete.");
}

runSeed();
