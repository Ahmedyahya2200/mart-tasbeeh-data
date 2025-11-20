// ============================================
// 📝 ملف: api/send.js
// 🔒 نسخة محسّنة وآمنة
// 📅 التاريخ: 2025-01-20
// ============================================

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '5mb', // زيادة الحد قليلاً
        },
    },
};

// ============================================
// 🛡️ Rate Limiting - منع السبام
// ============================================
const rateLimits = new Map();
const MAX_REQUESTS = 5;        // 5 رسائل كحد أقصى
const TIME_WINDOW = 60000;     // في دقيقة واحدة (60 ثانية)

// دالة التحقق من عدد الطلبات
function checkRateLimit(ip) {
    const now = Date.now();
    const userRequests = rateLimits.get(ip) || [];
    
    // إزالة الطلبات التي مر عليها أكثر من دقيقة
    const recentRequests = userRequests.filter(
        time => now - time < TIME_WINDOW
    );
    
    // إذا تجاوز الحد المسموح
    if (recentRequests.length >= MAX_REQUESTS) {
        return false;
    }
    
    // إضافة الطلب الجديد
    recentRequests.push(now);
    rateLimits.set(ip, recentRequests);
    
    return true;
}

// تنظيف الذاكرة كل 5 دقائق
setInterval(() => {
    const now = Date.now();
    for (const [ip, requests] of rateLimits.entries()) {
        const recentRequests = requests.filter(
            time => now - time < TIME_WINDOW
        );
        if (recentRequests.length === 0) {
            rateLimits.delete(ip);
        } else {
            rateLimits.set(ip, recentRequests);
        }
    }
}, 5 * 60 * 1000);

// ============================================
// 🔐 دالة تنظيف النصوص - منع XSS
// ============================================
function sanitizeText(text, maxLength = 4000) {
    if (!text || typeof text !== 'string') {
        return '';
    }
    
    return text
        .replace(/[<>]/g, '')           // إزالة HTML tags
        .replace(/[`]/g, '')            // إزالة backticks (حماية Markdown)
        .trim()
        .substring(0, maxLength);       // حد أقصى للطول
}

// ============================================
// 🎯 Main Handler Function
// ============================================
export default async function handler(req, res) {
    
    // ============================================
    // 1️⃣ CORS - السماح لمواقع محددة فقط
    // ============================================
    const allowedOrigins = [
        
        'https://smart-tasbeeh-data.vercel.app', // إذا كان موقعك على Vercel
        
    ];
    
    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (origin) {
        // طلب من نطاق غير مسموح
        console.warn(`⚠️ Blocked request from origin: ${origin}`);
        return res.status(403).json({ 
            error: 'غير مسموح بالوصول من هذا النطاق' 
        });
    }

    // ============================================
    // 2️⃣ معالجة طلبات Preflight (OPTIONS)
    // ============================================
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // ============================================
    // 3️⃣ السماح فقط بطلبات POST
    // ============================================
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'طريقة غير مسموحة. استخدم POST فقط.' 
        });
    }

    // ============================================
    // 4️⃣ Rate Limiting - التحقق من عدد الطلبات
    // ============================================
    const userIP = 
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
        req.headers['x-real-ip'] ||
        req.socket.remoteAddress || 
        'unknown';
    
    if (!checkRateLimit(userIP)) {
        console.warn(`⚠️ Rate limit exceeded for IP: ${userIP}`);
        return res.status(429).json({ 
            error: 'تم تجاوز الحد المسموح. يرجى المحاولة بعد دقيقة.',
            retryAfter: 60 
        });
    }

    // ============================================
    // 5️⃣ معالجة الطلب الرئيسي
    // ============================================
    try {
        const { name, message, photo } = req.body;
        
        // ============================================
        // 📋 التحقق من صحة البيانات المُدخلة
        // ============================================
        
        // التحقق من الرسالة (إجبارية)
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ 
                error: 'الرسالة مطلوبة ويجب أن تكون نص.' 
            });
        }

        if (message.trim().length === 0) {
            return res.status(400).json({ 
                error: 'لا يمكن إرسال رسالة فارغة.' 
            });
        }

        if (message.length > 4000) {
            return res.status(400).json({ 
                error: 'الرسالة طويلة جداً. الحد الأقصى 4000 حرف.' 
            });
        }

        // التحقق من الاسم (اختياري)
        if (name && (typeof name !== 'string' || name.length > 100)) {
            return res.status(400).json({ 
                error: 'الاسم طويل جداً. الحد الأقصى 100 حرف.' 
            });
        }

        // ============================================
        // 🧹 تنظيف البيانات
        // ============================================
        const sanitizedName = name ? 
            sanitizeText(name, 100) : 
            'زائر';
            
        const sanitizedMessage = sanitizeText(message, 4000);

        if (sanitizedMessage.length === 0) {
            return res.status(400).json({ 
                error: 'الرسالة تحتوي على محتوى غير صالح.' 
            });
        }

        // ============================================
        // 🔑 جلب التوكن من Environment Variables
        // ============================================
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

        if (!BOT_TOKEN || !CHAT_ID) {
            console.error('❌ Missing Telegram configuration in environment variables');
            return res.status(500).json({ 
                error: 'خطأ في إعدادات السيرفر. يرجى التواصل مع الدعم الفني.' 
            });
        }

        // ============================================
        // 📤 إرسال الرسالة النصية إلى Telegram
        // ============================================
        const text = `📩 *رسالة جديدة من الموقع*\n\n` +
                     `👤 *المرسل:* ${sanitizedName}\n` +
                     `🌐 *IP:* \`${userIP}\`\n` +
                     `⏰ *الوقت:* ${new Date().toLocaleString('ar-EG', { timeZone: 'Asia/Dubai' })}\n\n` +
                     `📝 *المحتوى:*\n${sanitizedMessage}`;

        const textUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        
        const textResponse = await fetch(textUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: text,
                parse_mode: 'Markdown'
            })
        });

        if (!textResponse.ok) {
            const errorData = await textResponse.json();
            console.error('❌ Telegram API Error:', errorData);
            throw new Error('فشل إرسال الرسالة إلى Telegram');
        }

        // ============================================
        // 📸 إرسال الصورة (إن وجدت)
        // ============================================
        if (photo) {
            try {
                // التحقق من صيغة الصورة
                if (!photo.startsWith('data:image/')) {
                    return res.status(400).json({ 
                        error: 'صيغة الصورة غير صالحة.' 
                    });
                }

                const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
                const imageType = photo.split(';')[0].split(':')[1];
                
                if (!validImageTypes.includes(imageType)) {
                    return res.status(400).json({ 
                        error: 'صيغة الصورة غير مدعومة. يُسمح فقط بـ: JPEG, PNG, WebP' 
                    });
                }

                // التحقق من حجم الصورة
                const base64Data = photo.split(',')[1];
                
                if (!base64Data) {
                    return res.status(400).json({ 
                        error: 'بيانات الصورة غير صالحة.' 
                    });
                }

                const sizeInBytes = (base64Data.length * 3) / 4;
                const sizeInMB = sizeInBytes / (1024 * 1024);
                
                if (sizeInMB > 5) {
                    return res.status(400).json({ 
                        error: `حجم الصورة كبير جداً (${sizeInMB.toFixed(2)}MB). الحد الأقصى 5MB.` 
                    });
                }

                // إرسال الصورة
                const photoUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
                const formData = new FormData();
                
                // تحويل Base64 إلى Blob
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: imageType });

                formData.append('chat_id', CHAT_ID);
                formData.append('photo', blob, 'screenshot.jpg');
                formData.append('caption', `📸 *مرفق من:* ${sanitizedName}\n🌐 IP: \`${userIP}\``, {
                    parse_mode: 'Markdown'
                });

                const photoResponse = await fetch(photoUrl, {
                    method: 'POST',
                    body: formData
                });

                if (!photoResponse.ok) {
                    console.error('⚠️ Failed to send photo to Telegram');
                    // لا نوقف العملية، الرسالة النصية تم إرسالها بنجاح
                }

            } catch (photoError) {
                console.error('⚠️ Error processing photo:', photoError);
                // لا نوقف العملية، الرسالة النصية تم إرسالها بنجاح
            }
        }

        // ============================================
        // ✅ نجاح العملية
        // ============================================
        console.log(`✅ Message sent successfully from IP: ${userIP}`);
        
        return res.status(200).json({ 
            status: 'success',
            message: 'تم إرسال رسالتك بنجاح. شكراً لتواصلك!' 
        });

    } catch (error) {
        // ============================================
        // ❌ معالجة الأخطاء
        // ============================================
        console.error('❌ Server Error:', {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });

        // عدم كشف تفاصيل الخطأ للمستخدم (أمان)
        return res.status(500).json({ 
            error: 'حدث خطأ في السيرفر. يرجى المحاولة لاحقاً أو التواصل مع الدعم الفني.',
            timestamp: new Date().toISOString()
        });
    }
}