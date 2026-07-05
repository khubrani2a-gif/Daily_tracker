# مفكرتي اليومية 🌙

ديلي تراكر إسلامي — صفحة واحدة (`index.html`) تعمل في أي متصفح بدون تثبيت.

يشمل: متتبع الصلاة (مع الضحى)، العبادات والأذكار، شرب الماء، النية، مهام اليوم، الأولويات، ذكرى اليوم، الملاحظات، تقييم اليوم، وشريط الإنجاز. يُحفظ كل يوم تلقائيًا في المتصفح، مع إمكانية نقل المهام غير المنجزة لليوم الجديد.

## التشغيل

افتح `index.html` في المتصفح مباشرة، أو فعّل GitHub Pages من إعدادات المستودع.

## تفعيل المزامنة السحابية بين الأجهزة (Firebase)

بدون تفعيلها يعمل التطبيق محليًا (كل جهاز له بياناته). لتفعيل المزامنة بحيث تجد نفس بياناتك على الجوال والكمبيوتر، اتبع الخطوات التالية مرة واحدة (نحو 10 دقائق، مجانية بالكامل):

### 1) أنشئ مشروع Firebase

1. ادخل إلى <https://console.firebase.google.com> بحساب Google الخاص بك
2. اضغط **Add project** وسمّه مثلًا `daily-tracker` وأكمل (يمكنك تعطيل Google Analytics)

### 2) فعّل تسجيل الدخول بحساب Google

1. من القائمة الجانبية: **Build ← Authentication ← Get started**
2. تبويب **Sign-in method** ← اختر **Google** ← فعّله واحفظ
3. ثم من تبويب **Settings ← Authorized domains** اضغط **Add domain** وأضف نطاق موقعك، مثلًا:
   `khubrani2a-gif.github.io`
   (بدون هذه الخطوة لن يعمل تسجيل الدخول من GitHub Pages)

### 3) أنشئ قاعدة البيانات Firestore

1. من القائمة الجانبية: **Build ← Firestore Database ← Create database**
2. اختر **Start in production mode** وأقرب موقع جغرافي لك
3. من تبويب **Rules** استبدل القواعد بالتالي ثم اضغط **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

هذه القواعد تعني: كل مستخدم يقرأ ويكتب بياناته هو فقط، ولا يستطيع أحد الاطلاع على بيانات غيره.

### 4) انسخ إعدادات المشروع

1. من أعلى القائمة الجانبية: ⚙️ **Project settings**
2. انزل إلى **Your apps** واضغط أيقونة الويب **`</>`**
3. سمّ التطبيق (أي اسم) واضغط **Register app** — لا تحتاج خطوة Hosting
4. سيظهر لك كائن `firebaseConfig` يشبه هذا:

```js
const firebaseConfig = {
  apiKey: "AIza....",
  authDomain: "daily-tracker-xxxx.firebaseapp.com",
  projectId: "daily-tracker-xxxx",
  storageBucket: "daily-tracker-xxxx.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
```

### 5) الصق الإعدادات في التطبيق

افتح `index.html` وابحث عن `FIREBASE_CONFIG` (قرب بداية الـ `<script>` الرئيسي) واملأ القيم الفارغة بقيمك:

```js
const FIREBASE_CONFIG = {
  apiKey: "AIza....",
  authDomain: "daily-tracker-xxxx.firebaseapp.com",
  projectId: "daily-tracker-xxxx",
  storageBucket: "daily-tracker-xxxx.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
```

ثم احفظ وارفع التعديل إلى GitHub.

> ملاحظة: هذه القيم ليست أسرارًا — من الطبيعي وجودها في كود صفحات الويب، والحماية الحقيقية تأتي من قواعد Firestore التي ضبطتها في الخطوة 3.

### 6) استخدم المزامنة

- افتح التطبيق وستجد زر **«☁️ تسجيل الدخول للمزامنة»** أعلى الصفحة
- سجّل الدخول بنفس حساب Google على كل أجهزتك
- كل تعديل يُحفظ محليًا **و** في السحابة تلقائيًا، وعند فتح أي يوم تُجلب أحدث نسخة (الأحدث زمنيًا هي التي تُعتمد)
- بدون إنترنت يستمر الحفظ محليًا، وتتم المزامنة عند عودة الاتصال وفتح اليوم من جديد
