// online/handler.js

function handleOnline(req, res) {
  // กำหนด Header ให้ส่งข้อมูลเป็น JSON (มาตรฐานของ API)
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const responseData = {
    status: 'success',
    message: 'เชื่อมต่อหน้า online สำเร็จ',
    timestamp: new Date().toISOString()
  };

  // ส่งผลลัพธ์กลับไปยัง Client
  res.end(JSON.stringify(responseData));
}

module.exports = handleOnline;