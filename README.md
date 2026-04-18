# Codenames · เกมสายลับภาษาไทย

เว็บเกม Codenames ภาษาไทย เล่นบนหน้าจอเดียวกันกับเพื่อน ๆ ได้เลย (ไม่ต้อง login, ไม่มี backend)

- การ์ดภาษาไทย 25 ใบสุ่มจากคลังคำศัพท์กว่า 450 คำ
- สายลับ (Spymaster) กดแสดง/ซ่อนกุญแจสีที่แผงด้านล่างได้ทันที
- ลากชิปสีไปวางบนการ์ดเพื่อทำเครื่องหมาย (ลากชิป "ลบ" เพื่อเอาออก)
- ใช้งานได้ทั้ง desktop และมือถือ (touch drag รองรับ)
- นับแต้ม สลับเทิร์น และตรวจจับการชนะ/แพ้อัตโนมัติ

## Run locally

```bash
# static files — just serve the folder
python3 -m http.server 8000
# แล้วเปิด http://localhost:8000
```

## เทคโนโลยี

Vanilla HTML + CSS + JavaScript (ES modules) ไม่มี build step, ไม่มี dependency

## License

MIT
