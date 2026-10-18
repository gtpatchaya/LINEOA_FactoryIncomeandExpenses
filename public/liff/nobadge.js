// ลบป้าย "Powered by Netlify" ที่ Netlify (แพ็กเกจ free) แทรกเข้ามาหลังหน้าโหลด
// ตัวป้ายอยู่ใน iframe ที่มี class/id ขึ้นต้นด้วย "nl-" — CSS ของหน้าเรามองเข้าไปไม่ได้ จึงลบตัว iframe ทิ้งแทน
(function () {
  var sel = "[class^='nl-'], [id^='nl-']";
  function clean() {
    document.querySelectorAll(sel).forEach(function (el) {
      if (el.closest("#app, #sheet, #intro, #modal, #main, #shell, #login")) return;
      el.remove();
    });
  }
  clean();
  new MutationObserver(clean).observe(document.documentElement, { childList: true, subtree: true });
})();
