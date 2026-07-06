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

// منع التخزين المؤقت
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

let sharedData = {
    cheques: [],
    transferts: [],
    clients: [],
    lastUpdate: new Date().toISOString(),
    company: 'HAMTECH'
};

// حمّل البيانات من الملف عند بدء السيرفر
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf-8');
            const parsed = JSON.parse(data);
            if (parsed && parsed.cheques) {
                sharedData = parsed;
                console.log(`✅ تم تحميل ${sharedData.cheques.length} شيك من الملف`);
            }
        } else {
            console.log('📝 إنشاء ملف جديد للبيانات');
            saveData();
        }
    } catch (error) {
        console.error('❌ خطأ في تحميل البيانات:', error);
        saveData();
    }
}

// احفظ البيانات في الملف
function saveData() {
    try {
        sharedData.lastUpdate = new Date().toISOString();
        fs.writeFileSync(DATA_FILE, JSON.stringify(sharedData, null, 2), 'utf-8');
        console.log(`✅ تم حفظ البيانات - ${sharedData.cheques.length} شيك`);
    } catch (error) {
        console.error('❌ خطأ في حفظ البيانات:', error);
    }
}

// حمّل البيانات عند بدء السيرفر
loadData();

// ===== API Routes =====

// الحصول على جميع البيانات
app.get('/api/data', (req, res) => {
    loadData(); // أعد تحميل من الملف للتأكد
    res.json({
        success: true,
        data: sharedData,
        timestamp: new Date().toISOString()
    });
});

// الحصول على الشيكات
app.get('/api/cheques', (req, res) => {
    loadData(); // أعد تحميل من الملف
    const status = req.query.status;
    let filtered = sharedData.cheques || [];
    
    if (status) {
        filtered = filtered.filter(c => c.statut === status);
    }
    
    res.json({
        success: true,
        cheques: filtered,
        total: filtered.length,
        montantTotal: filtered.reduce((sum, c) => sum + (c.valeur || 0), 0),
        timestamp: new Date().toISOString()
    });
});

// الإحصائيات
app.get('/api/stats', (req, res) => {
    loadData(); // أعد تحميل من الملف
    const cheques = sharedData.cheques || [];
    
    const stats = {
        totalCheques: cheques.length,
        montantTotal: cheques.reduce((sum, c) => sum + (c.valeur || 0), 0),
        enAttente: cheques.filter(c => c.statut === 'En attente').length,
        envoyes: cheques.filter(c => c.statut === 'Envoyé').length,
        rejetes: cheques.filter(c => c.statut === 'Rejeté').length,
        totalTransferts: (sharedData.transferts || []).length,
        totalClients: (sharedData.clients || []).length,
        lastUpdate: sharedData.lastUpdate
    };
    
    res.json({
        success: true,
        stats: stats,
        timestamp: new Date().toISOString()
    });
});

// تحديث البيانات
app.post('/api/update-data', (req, res) => {
    try {
        const { cheques, transferts, clients } = req.body;
        
        console.log(`📥 استقبال تحديث: ${cheques?.length || 0} شيك`);
        
        if (cheques) sharedData.cheques = cheques;
        if (transferts) sharedData.transferts = transferts;
        if (clients) sharedData.clients = clients;
        
        // احفظ فوراً على الملف
        saveData();
        
        res.json({
            success: true,
            message: 'تم التحديث بنجاح',
            lastUpdate: sharedData.lastUpdate,
            dataCount: {
                cheques: (sharedData.cheques || []).length,
                transferts: (sharedData.transferts || []).length,
                clients: (sharedData.clients || []).length
            }
        });
    } catch (error) {
        console.error('❌ خطأ:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// البحث
app.get('/api/search', (req, res) => {
    loadData();
    const q = req.query.q?.toLowerCase() || '';
    
    const results = {
        cheques: (sharedData.cheques || []).filter(c => 
            (c.client && c.client.toLowerCase().includes(q)) ||
            (c.numeroDoc && c.numeroDoc.toLowerCase().includes(q)) ||
            (c.banque && c.banque.toLowerCase().includes(q))
        ),
        clients: (sharedData.clients || []).filter(c => c.toLowerCase().includes(q))
    };
    
    res.json({
        success: true,
        results: results,
        timestamp: new Date().toISOString()
    });
});

// التحقق من الصحة
app.get('/health', (req, res) => {
    loadData();
    res.json({ 
        status: 'ok',
        dataCount: {
            cheques: (sharedData.cheques || []).length,
            transferts: (sharedData.transferts || []).length,
            clients: (sharedData.clients || []).length
        },
        timestamp: new Date().toISOString()
    });
});

// بدء السيرفر
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ السيرفر يعمل على المنفذ: ${PORT}`);
    console.log(`📱 URL: https://hamtech-server.vercel.app`);
    console.log(`📊 البيانات محفوظة في: ${DATA_FILE}`);
});
