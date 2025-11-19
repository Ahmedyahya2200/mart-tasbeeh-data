<?php
// 1. إجبار المتصفح على قراءة الرد كـ JSON فقط
header('Content-Type: application/json; charset=utf-8');

// إعدادات البوت (مخفية داخل السيرفر)
$botToken = "8330133673:AAGY1q4u-l4lKDStkxf4lrxYHPAAqnnPhMo";
$chatId = "1490007964";

// 2. الأمان: رفض أي طلب ليس من نوع POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['status' => 'error', 'message' => 'طريقة الطلب غير مسموحة']);
    exit;
}

// 3. الأمان: تنظيف المدخلات من أي أكواد برمجية (XSS Protection)
$name = isset($_POST['name']) ? strip_tags(trim($_POST['name'])) : 'فاعل خير';
$message = isset($_POST['message']) ? strip_tags(trim($_POST['message'])) : '';

// التحقق من أن الرسالة ليست فارغة
if (empty($message)) {
    echo json_encode(['status' => 'error', 'message' => 'الرسالة فارغة']);
    exit;
}

// تجهيز نص الرسالة
$text = "📩 *رسالة جديدة من الموقع:*\n👤 *الاسم:* $name\n📝 *المحتوى:* $message";

// متغير لتخزين حالة نجاح إرسال الصورة
$photoSent = false;

// 4. الأمان: التحقق من الصورة (إذا وجدت)
if (isset($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
    
    $fileTmpPath = $_FILES['photo']['tmp_name'];
    $fileSize = $_FILES['photo']['size'];
    $fileType = mime_content_type($fileTmpPath); // فحص نوع الملف الحقيقي وليس الاسم فقط
    
    // أ. التحقق من الحجم (مثلاً أقصى حد 5 ميجا)
    $maxFileSize = 5 * 1024 * 1024; 
    
    // ب. التحقق من نوع الملف (صور فقط)
    $allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

    if (!in_array($fileType, $allowedMimeTypes)) {
        echo json_encode(['status' => 'error', 'message' => 'نوع الملف غير مسموح. يرجى رفع صورة فقط.']);
        exit;
    }

    if ($fileSize > $maxFileSize) {
        echo json_encode(['status' => 'error', 'message' => 'حجم الصورة كبير جداً (الحد الأقصى 5 ميجا).']);
        exit;
    }

    // إرسال الصورة إلى تيليجرام
    $urlPhoto = "https://api.telegram.org/bot$botToken/sendPhoto";
    $postFields = [
        'chat_id' => $chatId,
        'photo' => new CURLFile($fileTmpPath, $fileType, $_FILES['photo']['name']),
        'caption' => "📸 مرفق من: $name"
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $urlPhoto);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $resultPhoto = curl_exec($ch);
    curl_close($ch);
    
    if ($resultPhoto) {
        $photoSent = true;
    }
}

// 5. إرسال الرسالة النصية (دائماً)
$urlText = "https://api.telegram.org/bot$botToken/sendMessage";
$dataText = [
    'chat_id' => $chatId,
    'text' => $text,
    'parse_mode' => 'Markdown'
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $urlText);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $dataText);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$resultText = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// 6. التحقق النهائي والرد على الموقع
if ($httpCode == 200) {
    echo json_encode(['status' => 'success', 'message' => 'تم الإرسال بنجاح']);
} else {
    echo json_encode(['status' => 'error', 'message' => 'فشل الاتصال بتيليجرام']);
}
?>
