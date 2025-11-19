<?php
// 1. إعدادات الأمان (هنا تضع التوكن ولا يمكن لأحد رؤيته)
$botToken = "8330133673:AAGY1q4u-l4lKDStkxf4lrxYHPAAqnnPhMo";
$chatId = "1490007964";

// التحقق من أن الطلب هو POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    
    // 2. استقبال البيانات من التطبيق
    $name = isset($_POST['name']) ? $_POST['name'] : 'غير معروف';
    $message = isset($_POST['message']) ? $_POST['message'] : '';
    
    // تجهيز الرسالة
    $text = "📩 *رسالة جديدة من الموقع:*\n👤 الاسم: $name\n📝 المحتوى: $message";

    // 3. إرسال النص (Text Message)
    $url = "https://api.telegram.org/bot$botToken/sendMessage";
    $data = [
        'chat_id' => $chatId,
        'text' => $text,
        'parse_mode' => 'Markdown'
    ];
    
    // استخدام CURL للإرسال
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $result = curl_exec($ch);
    curl_close($ch);

    // 4. إرسال الصور (إذا وجدت)
    if (isset($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
        $photoPath = $_FILES['photo']['tmp_name'];
        $photoName = $_FILES['photo']['name'];
        
        $urlPhoto = "https://api.telegram.org/bot$botToken/sendPhoto";
        $postFields = [
            'chat_id' => $chatId,
            'photo' => new CURLFile($photoPath, $_FILES['photo']['type'], $photoName),
            'caption' => "📸 مرفق من: $name"
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $urlPhoto);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_exec($ch);
        curl_close($ch);
    }

    // الرد بنجاح
    echo json_encode(["status" => "success"]);

} else {
    echo json_encode(["status" => "error", "message" => "Invalid Request"]);
}
?>
