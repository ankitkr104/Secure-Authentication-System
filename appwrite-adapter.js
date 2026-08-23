// appwrite-adapter.js

function getAppwriteClient() {
    if (typeof Appwrite === 'undefined') {
        console.error('Appwrite SDK not loaded.');
        return null;
    }
    const client = new Appwrite.Client();
    client
        .setEndpoint(document.getElementById('awEndpoint').value)
        .setProject(document.getElementById('awProjectId').value);
    
    return {
        client,
        account: new Appwrite.Account(client),
        storage: new Appwrite.Storage(client),
        bucketId: document.getElementById('awBucketId').value
    };
}

window.awRegister = async () => {
    const aw = getAppwriteClient();
    if (!aw) return;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    
    try {
        const res = await aw.account.create(Appwrite.ID.unique(), email, password);
        log('Appwrite Register', res);
    } catch (err) {
        log('Appwrite Register Error', err.message);
    }
};

window.awLogin = async () => {
    const aw = getAppwriteClient();
    if (!aw) return;
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const session = await aw.account.createEmailSession(email, password);
        const user = await aw.account.get();
        document.getElementById('token').value = session.$id;
        log('Appwrite Login', { session, user });
    } catch (err) {
        log('Appwrite Login Error', err.message);
    }
};

window.awLogout = async () => {
    const aw = getAppwriteClient();
    if (!aw) return;
    try {
        await aw.account.deleteSession('current');
        document.getElementById('token').value = '';
        log('Appwrite Logout', 'Success');
    } catch (err) {
        log('Appwrite Logout Error', err.message);
    }
};

window.awGetMe = async () => {
    const aw = getAppwriteClient();
    if (!aw) return;
    try {
        const user = await aw.account.get();
        log('Appwrite GET /me', user);
    } catch (err) {
        log('Appwrite GET /me Error', err.message);
    }
};

window.awGetFiles = async () => {
    const aw = getAppwriteClient();
    if (!aw) return;
    try {
        const filesList = await aw.storage.listFiles(aw.bucketId);
        const mapped = filesList.files.map(f => ({
            id: f.$id,
            filename: f.name,
            size: f.sizeOriginal,
            uploadedAt: f.$createdAt
        }));
        log('Appwrite GET /files', mapped);
    } catch (err) {
        log('Appwrite GET /files Error', err.message);
    }
};

window.awGetFileById = async () => {
    const aw = getAppwriteClient();
    if (!aw) return;
    const id = document.getElementById('fileId').value;
    try {
        const file = await aw.storage.getFile(aw.bucketId, id);
        log(`Appwrite GET /files/${id}`, file);
    } catch (err) {
        log(`Appwrite GET /files/${id} Error`, err.message);
    }
};

window.awDownloadFileById = async () => {
    const aw = getAppwriteClient();
    if (!aw) return;
    const id = document.getElementById('fileId').value;
    try {
        // Triggers actual file download
        const url = aw.storage.getFileDownload(aw.bucketId, id);
        const a = document.createElement('a');
        a.href = url;
        a.download = `file-${id}`;
        a.click();
        log(`Appwrite Download /files/${id}`, { url, note: 'File download triggered.' });
    } catch (err) {
        log(`Appwrite Download Error`, err.message);
    }
};
