// api/send.js

// زيادة حد حجم الطلب للسماح بالصور (حتى 5 ميجا)
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '5mb',
        },
    },
};

export default async function handler(req, res) {
    // 1. إعدادات CORS (للسماح لموقعك بالاتصال بالسيرفر)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // الرد على طلبات الفحص المسبق (Preflight)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // رفض أي طلب ليس POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { name, message, photo } = req.body;
        
        // جلب المفاتيح السرية من Vercel
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

        if (!BOT_TOKEN || !CHAT_ID) {
            return res.status(500).json({ error: 'Server Configuration Error' });
        }

        // 2. إرسال الرسالة النصية (دائماً)
        const text = `📩 *رسالة جديدة من الموقع:*\n👤 *الاسم:* ${name || 'فاعل خير'}\n📝 *المحتوى:* ${message || 'لا يوجد نص'}`;
        
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: text,
                parse_mode: 'Markdown'
            })
        });

        // 3. إرسال الصورة (إذا وجد المستخدم اختار صورة)
        // نستخدم هنا طريقة "Buffer" اليدوية لضمان عملها على Vercel Node.js
        if (photo) {
            // استخراج نوع الصورة وبياناتها من كود Base64
            // مثال: "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
            const matches = photo.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            
            if (matches && matches.length === 3) {
                const imageType = matches[1]; // نوع الصورة (مثلاً image/jpeg)
                const imageBuffer = Buffer.from(matches[2], 'base64'); // تحويل النص لبيانات خام

                // إنشاء "حدود" (Boundary) وهمية لطلب الـ Multipart
                const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
                
                // بناء جسم الطلب يدوياً
                let body = `--${boundary}\r\n`;
                body += `Content-Disposition: form-data; name="chat_id"\r\n\r\n${CHAT_ID}\r\n`;
                
                body += `--${boundary}\r\n`;
                body += `Content-Disposition: form-data; name="caption"\r\n\r\n📸 مرفق من: ${name}\r\n`;
                
                body += `--${boundary}\r\n`;
                body += `Content-Disposition: form-data; name="photo"; filename="image.jpg"\r\n`;
                body += `Content-Type: ${imageType}\r\n\r\n`;

                // دمج البيانات النصية مع بيانات الصورة الثنائية (Binary)
                const payload = Buffer.concat([
                    Buffer.from(body, 'utf-8'),
                    imageBuffer,
                    Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8')
                ]);

                // إرسال الطلب إلى تلجرام
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': `multipart/form-data; boundary=${boundary}`,
                        'Content-Length': payload.length
                    },
                    body: payload
                });
            }
        }

        // 4. الرد بنجاح
        return res.status(200).json({ status: 'success' });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
