const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = 'shared_data.json';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let sharedData = {
    cheques: [],
    transferts: [],
    clients: [],
    lastUpdate: new Date().toISOString(),
    company: 'HAMTECH'
};

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf-8');
            sharedData = JSON.parse(data);
        }
    } catch (error) {
        console.log('خطأ:', error);
    }
}

function saveData() {
    try {
        sharedData.lastUpdate = new Date().toISOString();
        fs.writeFileSync(DATA_FILE, JSON.stringify(sharedData, null, 2));
    } catch (error) {
        console.log('خطأ:', error);
    }
}

loadData();

// ===== API Routes =====

app.get('/api/data', (req, res) => {
    res.json({
        success: true,
        data: sharedData,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/cheques', (req, res) => {
    const status = req.query.status;
    let filtered = sharedData.cheques;
    
    if (status) {
        filtered = filtered.filter(c => c.statut === status);
    }
    
    res.json({
        success: true,
        cheques: filtered,
        total: filtered.length,
        montantTotal: filtered.reduce((sum, c) => sum + (c.valeur || 0), 0)
    });
});

app.get('/api/stats', (req, res) => {
    const stats = {
        totalCheques: sharedData.cheques.length,
        montantTotal: sharedData.cheques.reduce((sum, c) => sum + (c.valeur || 0), 0),
        enAttente: sharedData.cheques.filter(c => c.statut === 'En attente').length,
        envoyes: sharedData.cheques.filter(c => c.statut === 'Envoyé').length,
        rejetes: sharedData.cheques.filter(c => c.statut === 'Rejeté').length,
        totalTransferts: sharedData.transferts.length,
        totalClients: sharedData.clients.length
    };
    
    res.json({
        success: true,
        stats: stats
    });
});

app.post('/api/update-data', (req, res) => {
    try {
        const { cheques, transferts, clients } = req.body;
        
        if (cheques) sharedData.cheques = cheques;
        if (transferts) sharedData.transferts = transferts;
        if (clients) sharedData.clients = clients;
        
        saveData();
        
        res.json({
            success: true,
            message: 'تم التحديث',
            lastUpdate: sharedData.lastUpdate
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/search', (req, res) => {
    const q = req.query.q?.toLowerCase() || '';
    
    const results = {
        cheques: sharedData.cheques.filter(c => 
            (c.client && c.client.toLowerCase().includes(q)) ||
            (c.numeroDoc && c.numeroDoc.toLowerCase().includes(q)) ||
            (c.banque && c.banque.toLowerCase().includes(q))
        ),
        clients: sharedData.clients.filter(c => c.toLowerCase().includes(q))
    };
    
    res.json({
        success: true,
        results: results
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`✅ السيرفر يعمل على: http://localhost:${PORT}`);
});
