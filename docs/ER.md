# ER Diagram (Firestore)

```mermaid
erDiagram
    USERS ||--o{ TRANSACTIONS : "บันทึก (userId)"
    SETTINGS ||--o{ TRANSACTIONS : "กำหนดหมวดหมู่ที่ใช้ได้ (category)"

    USERS {
        string id PK "LINE userId (doc id)"
        string displayName
        string pictureUrl
        string nickname "ตั้งจากหลังบ้าน"
        boolean active "false = ระงับ"
        number openingBalance "ยอดยกมา"
        string createdAt "ISO"
    }
    TRANSACTIONS {
        string id PK "auto id"
        string userId FK "-> users.id"
        string type "income | expense"
        number amount "> 0"
        string category "ต้องอยู่ใน settings.categories[type]"
        string note
        string date "YYYY-MM-DD (วันที่ของรายการ)"
        string ym "YYYY-MM (ใช้ query รายเดือน)"
        string status "active | cancelled"
        string source "liff | line"
        string createdAt "ISO"
        string cancelledAt "ISO"
        string cancelledBy "user | admin"
    }
    SETTINGS {
        string id PK "app (doc เดียว)"
        string shopName
        array categories_expense
        array categories_income
    }
```

- Firestore เป็น NoSQL: `transactions.userId` เป็นการอ้างอิงด้วยค่า ไม่มี foreign key จริง
- `category` ในรายการเก็บเป็นข้อความ จึงแก้/ลบหมวดที่หลังบ้านได้โดยไม่กระทบรายการเก่า
- Query ทุกตัวใช้ equality (`userId`, `ym`) จึงไม่ต้องสร้าง composite index
- ยอดสรุป/คงเหลือคำนวณจากรายการที่ `status = active` ไม่เก็บยอดสะสมซ้ำ
