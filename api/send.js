export const config = {
    api: {
        bodyParser: {
            sizeLimit: '4mb',
        },
    },
};

export default async function handler(req, res) {
    // السماح للموقع بالاتصال (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // التعامل مع طلبات Preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { name, message, photo } = req.body;
        
        // جلب التوكن والآيدي من إعدادات فيرسل السرية
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

        if (!BOT_TOKEN || !CHAT_ID) {
            return res.status(500).json({ error: 'Configuration Error: Missing Tokens' });
        }

        const text = `📩 *رسالة جديدة من الموقع:*\n👤 *الاسم:* ${name}\n📝 *المحتوى:* ${message}`;

        // 1. إرسال النص
        const textUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        await fetch(textUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: text,
                parse_mode: 'Markdown'
            })
        });

        // 2. إرسال الصورة (إن وجدت)
        if (photo) {
            const photoUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
            const formData = new FormData();
            
            // تحويل الصورة من Base64 إلى ملف
            const base64Data = photo.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/jpeg' });

            formData.append('chat_id', CHAT_ID);
            formData.append('photo', blob, 'image.jpg');
            formData.append('caption', `📸 مرفق من: ${name}`);

            await fetch(photoUrl, {
                method: 'POST',
                body: formData
            });
        }

        return res.status(200).json({ status: 'success' });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
