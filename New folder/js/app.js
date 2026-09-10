/* ==========================================
   MSTORE - Main Application Logic
   ========================================== */

/* ==========================================
   MSTORE DATA SYNC — Netlify Static Deploy
   ==========================================
   البيانات تُقرأ من data.json عند أول تشغيل
   ليراها جميع المستخدمين على Netlify.
   عند التعديل من الأدمن → اضغط «نشر للموقع»
   ثم استبدل data.json في المشروع وارفعه.
   ========================================== */
(function bootstrapFromDataJson(){
  var DATA_KEYS = [
    'mstore_custom_series',
    'mstore_custom_products',
    'mstore_product_details',
    'mstore_product_overrides',
    'mstore_setting_facebook',
    'mstore_setting_tiktok',
    'mstore_setting_whatsapp_eg',
    'mstore_setting_whatsapp_uae',
    'mstore_setting_eyebrow',
    'mstore_setting_hero_title'
  ];
  var LOADED_FLAG = 'mstore_data_json_loaded_v1';

  // نقرأ data.json وإذا كان الإصدار جديداً أو غير موجود في localStorage نقوم بالتحديث التلقائي
  fetch('data.json?v=' + Date.now())
    .then(function(r){ return r.json(); })
    .then(function(data){
      var currentVersion = localStorage.getItem(LOADED_FLAG);
      var newVersion = String(data._version || '1');
      if (currentVersion === newVersion) return; // تم التحديث مسبقاً بنفس الإصدار

      DATA_KEYS.forEach(function(key){
        if(data[key] !== undefined && data[key] !== null){
          var val = (typeof data[key] === 'string') ? data[key] : JSON.stringify(data[key]);
          try{ localStorage.setItem(key, val); }catch(e){}
        }
      });
      localStorage.setItem(LOADED_FLAG, newVersion);

      // إعادة تطبيق التحديثات على الصفحة
      if(typeof applyStoreSettingsToPage === 'function') applyStoreSettingsToPage();
      if(typeof renderCustomSeriesToCatalog === 'function') renderCustomSeriesToCatalog();
      if(typeof applyProductOverridesToStore === 'function') applyProductOverridesToStore();
    })
    .catch(function(){ /* data.json not found or error – use localStorage as-is */ });
})();

/* ---------- Horizontal series scroll controls ---------- */
function scrollProducts(sid,dir){
  var track=document.getElementById('grid-'+sid);
  if(!track) return;
  var cardWidth=track.querySelector('.product-card').offsetWidth+9;
  /* dir: 1 = "التالي" (next/forward), -1 = "السابق" (previous) */
  track.scrollBy({left: -dir*cardWidth, behavior:'smooth'});
}

/* ---------- Menu ---------- */
function toggleMenu(){document.getElementById('menu').classList.toggle('open')}
function closeIfOutside(e){if(e.target.id==='menu')toggleMenu()}

/* ---------- Hero mini-carousel ---------- */

var heroIndex=0;
function setHero(i,btn){
  var img=document.getElementById('heroImg');
  img.style.opacity='0';
  setTimeout(function(){
    img.src=heroModels[i].img; img.alt=heroModels[i].label;
    img.style.opacity='.97';
  },180);
  var dots=document.querySelectorAll('.dots .dot');
  dots.forEach(function(d){d.classList.remove('active');d.setAttribute('aria-selected','false')});
  var target=btn||dots[i];
  if(target){target.classList.add('active'); target.setAttribute('aria-selected','true');}
  heroIndex=i;
}
(function heroAutoplay(){
  var reduce=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce) return;
  setInterval(function(){
    if(!document.body.classList.contains('home-active')) return;
    setHero((heroIndex+1)%heroModels.length);
  },4000);
})();

/* ---------- Jump + highlight a catalog series ---------- */
function highlightSeries(id){
  setTimeout(function(){
    var el=document.getElementById(id);
    if(!el) return;
    el.scrollIntoView({behavior:'smooth',block:'start'});
    document.querySelectorAll('.catalog-section.flash').forEach(function(s){s.classList.remove('flash')});
    el.classList.add('flash');
    setTimeout(function(){el.classList.remove('flash')},2200);
  },150);
}

/* ---------- Arabic Text Normalizer & Search ---------- */
function normalizeArabic(str){
  if(!str) return '';
  return str
    .replace(/[\u064B-\u065F\u0670]/g, '') // strip tashkeel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/[\s\-_]+/g, ' ')
    .toLowerCase()
    .trim();
}

function toggleSearch(){
  var panel=document.getElementById('searchPanel');
  panel.classList.toggle('open');
  if(panel.classList.contains('open')) document.getElementById('searchInput').focus();
  else document.getElementById('searchInput').value='';
}
function getCatalog(){
  return Array.prototype.map.call(document.querySelectorAll('#catalog .product-card'),function(card){
    var nameEl = card.querySelector('.product-name');
    var priceEl = card.querySelector('.product-price');
    var sec = card.closest('.catalog-section');
    return {
      name: nameEl ? nameEl.textContent.trim() : '',
      price: priceEl ? priceEl.textContent.replace(/\s+/g,' ').trim() : '',
      sectionId: sec ? (sec.id || '') : '',
      cardId: card.id || ''
    };
  });
}
function runSearch(q){
  var results=document.getElementById('searchResults');
  results.innerHTML = '';
  var trimmed = q.trim();
  if(!trimmed) return;
  var normQ = normalizeArabic(trimmed);
  var matches=getCatalog().filter(function(p){
    var normName = normalizeArabic(p.name);
    var normSec = normalizeArabic(p.sectionId);
    return normName.indexOf(normQ) > -1 || normSec.indexOf(normQ) > -1 || p.price.indexOf(trimmed) > -1;
  });
  if(!matches.length){
    var empty = document.createElement('div');
    empty.className = 'search-empty';
    empty.textContent = 'لا توجد نتائج مطابقة لـ «' + q + '»';
    results.appendChild(empty);
    return;
  }
  matches.slice(0,8).forEach(function(p){
    var a = document.createElement('a');
    a.href = '#product';
    a.onclick = function(e){
      e.preventDefault();
      toggleSearch();
      openProductByName(p.name);
    };
    var nameSpan = document.createElement('span');
    nameSpan.textContent = p.name;
    var priceSpan = document.createElement('span');
    priceSpan.textContent = p.price;
    a.appendChild(nameSpan);
    a.appendChild(priceSpan);
    results.appendChild(a);
  });

}

function openProductByName(name){
  var targetCard = null;
  document.querySelectorAll('#catalog .product-card').forEach(function(card){
    var nEl = card.querySelector('.product-name');
    if(nEl && nEl.textContent.trim().toLowerCase() === name.trim().toLowerCase()){
      targetCard = card;
    }
  });
  if(targetCard){
    var vLink = targetCard.querySelector('.view-device');
    if(vLink) openProduct(vLink);
  } else {
    showPage('product');
    document.getElementById('pdTitle').textContent = name;
  }
}

/* ---------- Product detail page & Auto-sliding Gallery ---------- */
var pdBasePrice=5199, pdStorageAdd=0, pdConditionMult=1, pdConditionFixedPrice=null;
var pdGalleryTimer=null, pdCurrentImages=[], pdCurrentIndex=0;

function pdFormat(n){return Math.round(n).toLocaleString('en-US')}
function updatePdPrice(){
  var base = (pdConditionFixedPrice !== null && pdConditionFixedPrice > 0) ? pdConditionFixedPrice : (pdBasePrice * pdConditionMult);
  var total = base + pdStorageAdd;
  document.getElementById('pdPrice').textContent=pdFormat(total);
  document.getElementById('stickyPrice').textContent=pdFormat(total)+' AED';
}

function getAllProductDetails(){
  try{
    return JSON.parse(localStorage.getItem('mstore_product_details')) || {};
  }catch(e){return {};}
}

function stopPdGalleryAutoSlide(){
  if(pdGalleryTimer){
    clearInterval(pdGalleryTimer);
    pdGalleryTimer=null;
  }
}

function startPdGalleryAutoSlide(){
  stopPdGalleryAutoSlide();
  if(!pdCurrentImages || pdCurrentImages.length <= 1) return;
  pdGalleryTimer = setInterval(function(){
    var nextIndex = (pdCurrentIndex + 1) % pdCurrentImages.length;
    setPdGalleryIndex(nextIndex, false);
  }, 2800);
}

function setPdGalleryIndex(idx, userAction){
  if(!pdCurrentImages || pdCurrentImages.length === 0) return;
  pdCurrentIndex = idx;
  var mainImg = document.getElementById('pdMainImg');
  if(mainImg){
    mainImg.style.opacity = '0';
    setTimeout(function(){
      mainImg.src = pdCurrentImages[pdCurrentIndex];
      mainImg.style.opacity = '1';
    }, 160);
  }
  
  var thumbs = document.querySelectorAll('.thumbnails .thumb');
  thumbs.forEach(function(t, i){
    t.classList.toggle('active', i === pdCurrentIndex);
  });
  
  var dots = document.querySelectorAll('#galleryDots i');
  dots.forEach(function(d, i){
    d.classList.toggle('active', i === pdCurrentIndex);
  });
  
  if(userAction){
    startPdGalleryAutoSlide();
  }
}

function openProduct(link, e){
  if(e) e.preventDefault();
  showPage('product');
  var card = link.closest('.product-card');
  if(!card) return;
  var name = card.querySelector('.product-name').textContent.trim();
  var priceDigits = card.querySelector('.product-price').textContent.replace(/[^\d]/g,'');
  pdStorageAdd = 0; pdConditionMult = 1; pdConditionFixedPrice = null;
  
  var allDetails = getAllProductDetails();
  var details = allDetails[name] || {};
  
  // Use stored price if available, else fall back to card DOM price
  pdBasePrice = (details.price && details.price > 0) ? details.price : (parseInt(priceDigits, 10) || 0);
  
  // Title
  document.getElementById('pdTitle').textContent = details.name || name;
  document.querySelector('.product-title').textContent = details.name || name;
  
  // Series crumb + remember parent section for back navigation
  var sec = card.closest('.catalog-section');
  var secId = sec ? sec.id : null;
  var sTitle = sec ? (sec.querySelector('.catalog-title h3') || sec.querySelector('h3')) : null;
  if(sTitle){
    var badge2 = sTitle.querySelector('.new-badge');
    var badgeText2 = badge2 ? badge2.textContent : '';
    var cleanSeries = sTitle.textContent.replace(badgeText2,'').replace(/‹|›|عرض الكل/g,'').trim();
    var sCrumb = document.getElementById('pdSeriesCrumb');
    if(sCrumb){
      sCrumb.textContent = cleanSeries;
      // Update crumb and back-link onclick to return to this specific department
      sCrumb.onclick = function(ev){
        if(ev) ev.preventDefault();
        goToCatalog(ev, secId);
      };
    }
  }
  // Also update the back-link in product-nav to return to the correct dept
  var backLink = document.getElementById('pdBackLink');
  if(backLink){
    backLink.onclick = function(ev){
      if(ev) ev.preventDefault();
      goToCatalog(ev, secId);
    };
  }
  
  // Badge display (Inside detail page)
  var badgeEl = document.getElementById('pdGalleryBadge');
  if(badgeEl){
    var bText = details.badge || '';
    if(!bText && card){
      var cB = card.querySelector('.product-card-badge');
      if(cB) bText = cB.textContent.trim();
    }
    if(bText){
      badgeEl.textContent = bText;
      badgeEl.style.display = 'block';
    } else {
      badgeEl.style.display = 'none';
    }
  }
  
  // Images Gallery
  var cardImg = card.querySelector('.product-img');
  var baseImg = details.img || (cardImg ? cardImg.src : '');
  if(details.images && Array.isArray(details.images) && details.images.length > 0){
    pdCurrentImages = details.images.slice();
  } else if(baseImg){
    pdCurrentImages = [baseImg];
  } else {
    pdCurrentImages = ['https://commons.wikimedia.org/wiki/Special:Redirect/file/IPhone_17_Pro.png'];
  }
  
  // Build Thumbnails
  var thumbsWrap = document.querySelector('.thumbnails');
  if(thumbsWrap){
    thumbsWrap.innerHTML = '';
    pdCurrentImages.forEach(function(imgSrc, i){
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'thumb' + (i === 0 ? ' active' : '');
      var img = document.createElement('img');
      img.src = imgSrc;
      img.alt = (details.name || name) + ' ' + (i + 1);
      btn.appendChild(img);
      btn.onclick = function(){ setPdGalleryIndex(i, true); };
      thumbsWrap.appendChild(btn);
    });
  }
  
  // Build Dots
  var dotsWrap = document.getElementById('galleryDots');
  if(dotsWrap){
    dotsWrap.innerHTML = '';
    pdCurrentImages.forEach(function(_, i){
      var dot = document.createElement('i');
      if(i === 0) dot.className = 'active';
      dotsWrap.appendChild(dot);
    });
  }
  
  // Set Main Image
  var mainImg = document.getElementById('pdMainImg');
  if(mainImg){
    mainImg.src = pdCurrentImages[0];
    mainImg.style.opacity = '1';
  }
  pdCurrentIndex = 0;
  startPdGalleryAutoSlide();
  
  // Specs (with editable OS)
  var specsList = document.querySelector('.specs-list');
  if(specsList){
    specsList.innerHTML =
      '<div class="spec-row"><span class="spec-ico">▭</span> الشاشة: ' + (details.screen || 'Super Retina XDR') + '</div>' +
      '<div class="spec-row"><span class="spec-ico">◆</span> الشريحة: ' + (details.chip || 'Bionic / Apple Silicon') + '</div>' +
      '<div class="spec-row"><span class="spec-ico">◎</span> الكاميرا: ' + (details.camera || 'نظام كاميرات احترافي') + '</div>' +
      '<div class="spec-row"><span class="spec-ico">▮</span> البطارية: ' + (details.battery || 'تدوم طوال اليوم') + '</div>' +
      '<div class="spec-row"><span class="spec-ico">⟳</span> نظام التشغيل: ' + (details.os || 'iOS 18') + '</div>';
  }
  
  // Colors
  var swatchesBox = document.getElementById('colorSwatches');
  if(swatchesBox && details.colors && details.colors.length > 0){
    swatchesBox.innerHTML = '';
    details.colors.forEach(function(c, i){
      var btn = document.createElement('button');
      btn.className = 'swatch' + (i === 0 ? ' active' : '');
      btn.style.background = c.code;
      btn.setAttribute('aria-label', c.label);
      btn.onclick = function(){ setColor(btn, c.label); };
      swatchesBox.appendChild(btn);
    });
    document.getElementById('metaColor').textContent = details.colors[0].label;
  } else {
    document.getElementById('metaColor').textContent = 'أسود فضائي';
    document.querySelectorAll('#colorSwatches .swatch').forEach(function(s, i){ s.classList.toggle('active', i === 0); });
  }
  
  // Storage Options
  var storageBox = document.getElementById('storagePills');
  if(storageBox && details.storages && details.storages.length > 0){
    storageBox.innerHTML = '';
    details.storages.forEach(function(st, i){
      var btn = document.createElement('button');
      btn.className = 'pill' + (i === 0 ? ' active' : '');
      btn.innerHTML = st.size + (st.add > 0 ? '<small>+' + st.add + ' AED</small>' : '');
      btn.onclick = function(){ setStorage(btn, st.add); };
      storageBox.appendChild(btn);
    });
    document.getElementById('metaStorage').textContent = details.storages[0].size;
  } else {
    document.getElementById('metaStorage').textContent = '256GB';
    document.querySelectorAll('#storagePills .pill').forEach(function(p, i){ p.classList.toggle('active', i === 0); });
  }

  // Conditions & Pricing Builder Binding
  var conditionBox = document.getElementById('conditionPills');
  if(conditionBox && details.conditions && Array.isArray(details.conditions) && details.conditions.length > 0){
    conditionBox.innerHTML = '';
    details.conditions.forEach(function(cond, i){
      var btn = document.createElement('button');
      btn.className = 'pill' + (i === 0 ? ' active' : '');
      btn.innerHTML = cond.label + (cond.price > 0 ? ' <small>' + pdFormat(cond.price) + ' AED</small>' : '');
      btn.onclick = function(){ setCustomCondition(btn, cond.label, cond.price); };
      conditionBox.appendChild(btn);
    });
    pdConditionFixedPrice = details.conditions[0].price;
    pdConditionMult = 1;
    document.getElementById('metaCondition').textContent = details.conditions[0].label;
  } else {
    pdConditionFixedPrice = null;
    pdConditionMult = 1;
    document.getElementById('metaCondition').textContent = 'جديد';
    document.querySelectorAll('#conditionPills .pill').forEach(function(p, i){ p.classList.toggle('active', i === 0); });
  }
  
  // About / Description
  var aboutP = document.querySelector('.about-block p');
  if(aboutP && details.about){
    aboutP.textContent = details.about;
  }
  
  updatePdPrice();
}

function setCustomCondition(el, label, price){
  document.querySelectorAll('#conditionPills .pill').forEach(function(p){ p.classList.remove('active'); });
  el.classList.add('active');
  pdConditionFixedPrice = parseInt(price, 10) || 0;
  document.getElementById('metaCondition').textContent = label;
  updatePdPrice();
}

function setColor(el,label){
  document.querySelectorAll('#colorSwatches .swatch').forEach(function(s){s.classList.remove('active')});
  el.classList.add('active');
  document.getElementById('metaColor').textContent=label;
}
function setStorage(el,add){
  document.querySelectorAll('#storagePills .pill').forEach(function(p){p.classList.remove('active')});
  el.classList.add('active');
  pdStorageAdd=add;
  document.getElementById('metaStorage').textContent=el.childNodes[0].textContent.trim();
  updatePdPrice();
}
function setCondition(el,mult,label){
  document.querySelectorAll('#conditionPills .pill').forEach(function(p){p.classList.remove('active')});
  el.classList.add('active');
  pdConditionMult=mult;
  document.getElementById('metaCondition').textContent=label;
  updatePdPrice();
}
function setThumb(el){
  var idx = Array.prototype.indexOf.call(el.parentNode.children, el);
  if(idx > -1) setPdGalleryIndex(idx, true);
}
function toggleWishlist(btn){
  var on=btn.classList.toggle('on');
  btn.textContent=on?'♥':'♡';
}
var currentOrderMessage = '';
function buyNow(){
  var prodName = document.getElementById('pdTitle').textContent;
  var total = (pdConditionFixedPrice !== null && pdConditionFixedPrice > 0) ? (pdConditionFixedPrice + pdStorageAdd) : ((pdBasePrice + pdStorageAdd) * pdConditionMult);
  var prodColor = document.getElementById('metaColor').textContent;
  var prodStorage = document.getElementById('metaStorage').textContent;
  var prodCond = document.getElementById('metaCondition').textContent;
  currentOrderMessage = encodeURIComponent('مرحباً MSTORE 👋 أرغب في طلب وشراء:\n📱 الجهاز: ' + prodName + '\n💾 السعة: ' + prodStorage + '\n🎨 اللون: ' + prodColor + '\n✨ الحالة: ' + prodCond + '\n💰 السعر: ' + Math.round(total).toLocaleString('en-US') + ' AED');
  openWhatsappModal();
}
/* ---------- Page router: show exactly one page at a time ---------- */
var PAGE_IDS=['main-content','catalog','product'];
function showPage(id){
  PAGE_IDS.forEach(function(pid){
    var el=document.getElementById(pid);
    if(el) el.style.display=(pid===id)?'block':'none';
  });
  if(id !== 'product'){
    stopPdGalleryAutoSlide();
  }
  document.body.classList.toggle('home-active', id==='main-content');
  var sticky=document.getElementById('productStickyBar');
  if(sticky) sticky.hidden=(id!=='product');
  var menu=document.getElementById('menu');
  if(menu) menu.classList.remove('open');
  var panel=document.getElementById('searchPanel');
  if(panel) panel.classList.remove('open');
  window.scrollTo({top:0,behavior:'auto'});
}
function goHome(e,subId){
  if(e) e.preventDefault();
  showPage('main-content');
  if(subId){
    setTimeout(function(){
      var el=document.getElementById(subId);
      if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
    },60);
  }
}
/* Track the currently active series context (null = all devices) */
var catalogCurrentSeriesId = null;

function goToCatalog(e, subId){
  if(e) e.preventDefault();
  catalogCurrentSeriesId = subId || null;
  showPage('catalog');
  
  var allSections = document.querySelectorAll('#catalog .catalog-section');
  var titleEl = document.getElementById('catalogTitle');
  var breadEl = document.getElementById('catalogBreadcrumb');
  var subtitleEl = document.getElementById('catalogSubtitle');
  
  if(subId){
    // --- Department-specific view: hide all sections except the target ---
    allSections.forEach(function(sec){
      sec.style.display = (sec.id === subId) ? 'block' : 'none';
    });
    // Update header to reflect this department's name
    var targetSec = document.getElementById(subId);
    var deptTitle = '';
    if(targetSec){
      var h3 = targetSec.querySelector('.catalog-title h3') || targetSec.querySelector('h3');
      if(h3){
        // Get clean title from h3 (strip badge text)
        var badge = h3.querySelector('.new-badge');
        var badgeText = badge ? badge.textContent : '';
        deptTitle = h3.textContent.replace(badgeText,'').trim();
      }
    }
    // Fallback: look in custom series data
    if(!deptTitle){
      var customSeries = getCustomSeries();
      var found = customSeries.filter(function(cs){ return cs.id === subId; });
      if(found.length) deptTitle = found[0].title;
    }
    if(deptTitle){
      if(titleEl) titleEl.textContent = deptTitle;
      if(breadEl) breadEl.textContent = deptTitle;
      if(subtitleEl) subtitleEl.textContent = 'استعرض جميع الأجهزة في قسم ' + deptTitle + '.';
    }
  } else {
    // --- All devices view: show all sections ---
    allSections.forEach(function(sec){
      sec.style.display = 'block';
    });
    if(titleEl) titleEl.textContent = 'جميع الأجهزة والأقسام';
    if(breadEl) breadEl.textContent = 'جميع الأجهزة';
    if(subtitleEl) subtitleEl.textContent = 'استكشف جميع السلاسل والأجهزة المتاحة في المتجر.';
  }
}

// Ensure every reload/load returns to home page and scrolls to top
if('scrollRestoration' in history){
  history.scrollRestoration = 'manual';
}
if(window.location.hash && window.location.hash !== '#admin'){
  try{ history.replaceState(null, null, window.location.pathname); }catch(e){}
}
window.scrollTo(0, 0);
showPage('main-content');

/* ---------- Stars: relocate quietly while faded out ---------- */
(function starsWander(){
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce) return;
  document.querySelectorAll('.bg-anim .star').forEach(function(star){
    star.addEventListener('animationiteration', function(){
      var top = (4 + Math.random()*88).toFixed(1);
      var left = (4 + Math.random()*88).toFixed(1);
      star.style.top = top+'%';
      star.style.left = left+'%';
    });
  });
})();

/* ==========================================
   ADMIN PANEL & SECRET ACCESS LOGIC
   ========================================== */

/* ---------- Secret Triggers ---------- */
var logoClickCount=0, logoClickTimer=null;
function handleLogoClick(e){
  if(e && e.preventDefault) e.preventDefault();
  logoClickCount++;
  clearTimeout(logoClickTimer);
  logoClickTimer=setTimeout(function(){ logoClickCount=0; }, 1200);
  if(logoClickCount>=5){
    logoClickCount=0;
    openAdminLogin();
  } else {
    goHome(e);
  }
}

var footerClickCount=0, footerClickTimer=null;
function handleFooterClick(e){
  footerClickCount++;
  clearTimeout(footerClickTimer);
  if(footerClickCount>=3){
    footerClickCount=0;
    openAdminLogin();
    return;
  }
  footerClickTimer=setTimeout(function(){footerClickCount=0;},1200);
}

window.addEventListener('keydown',function(e){
  if((e.ctrlKey && e.shiftKey && e.key.toLowerCase()==='a') || (e.altKey && e.key.toLowerCase()==='a')){
    e.preventDefault();
    openAdminLogin();
  } else if(e.key === 'Escape' || e.key === 'Esc'){
    closeAllModalsAndDrawers();
  }
});

function closeAllModalsAndDrawers(){
  document.querySelectorAll('.admin-modal-overlay').forEach(function(m){
    m.classList.remove('open');
  });
  var menu=document.getElementById('menu');
  if(menu) menu.classList.remove('open');
  var panel=document.getElementById('searchPanel');
  if(panel) panel.classList.remove('open');
  if(window.location.hash==='#admin'){
    try{ window.history.replaceState(null, null, window.location.pathname); }catch(ex){}
  }
}

window.addEventListener('hashchange',function(){
  if(window.location.hash==='#admin'){
    openAdminLogin();
  }
});

/* ---------- Admin Auth ---------- */
function getAdminPassword(){
  return localStorage.getItem('mstore_admin_pass') || 'admin123';
}

function openAdminLogin(){
  var modal=document.getElementById('adminLoginModal');
  var input=document.getElementById('adminPasswordInput');
  var err=document.getElementById('adminErrorMsg');
  if(modal){
    modal.classList.add('open');
    if(input){input.value='';input.focus();}
    if(err) err.classList.remove('visible');
  }
}

function closeAdminLogin(){
  var modal=document.getElementById('adminLoginModal');
  if(modal) modal.classList.remove('open');
  if(window.location.hash==='#admin'){
    try{ window.history.replaceState(null, null, window.location.pathname); }catch(ex){}
  }
}

function closeAdminLoginIfOutside(e){
  if(e.target.id==='adminLoginModal') closeAdminLogin();
}

function checkAdminPassword(){
  var input=document.getElementById('adminPasswordInput');
  var val=input?input.value.trim():'';
  var err=document.getElementById('adminErrorMsg');
  var box=document.querySelector('.admin-login-box');
  
  if(val===getAdminPassword()){
    closeAdminLogin();
    openAdminDashboard();
  }else{
    if(err) err.classList.add('visible');
    if(box){
      box.classList.remove('shake');
      void box.offsetWidth; // trigger reflow
      box.classList.add('shake');
    }
    if(input) input.select();
  }
}

/* ---------- Admin Dashboard ---------- */
function openAdminDashboard(){
  var dash=document.getElementById('adminDashboardModal');
  if(dash){
    dash.classList.add('open');
    loadAdminData();
  }
}

function closeAdminDashboard(){
  var dash=document.getElementById('adminDashboardModal');
  if(dash) dash.classList.remove('open');
  if(window.location.hash==='#admin'){
    try{ window.history.replaceState(null, null, window.location.pathname); }catch(ex){}
  }
}

function closeAdminDashIfOutside(e){
  if(e.target.id==='adminDashboardModal') closeAdminDashboard();
}

function adminLogout(){
  closeAdminDashboard();
  alert('تم تسجيل الخروج من لوحة التحكم بنجاح 👋');
}

function switchAdminTab(tabName){
  document.querySelectorAll('.admin-tab-btn').forEach(function(b){b.classList.remove('active')});
  document.querySelectorAll('.admin-tab-content').forEach(function(c){c.classList.remove('active')});
  
  var targetBtn = (typeof event !== 'undefined' && event && event.target) ? event.target.closest('.admin-tab-btn') : null;
  if(targetBtn) targetBtn.classList.add('active');
  else{
    var btns=document.querySelectorAll('.admin-tab-btn');
    var tabIdx=['products','series','settings'].indexOf(tabName);
    if(tabIdx>-1 && btns[tabIdx]) btns[tabIdx].classList.add('active');
  }
  
  var content=document.getElementById('adminTab-'+tabName);
  if(content) content.classList.add('active');
  
  if(tabName==='products') renderAdminProducts();
  if(tabName==='series') renderAdminSeriesTable();
  if(tabName==='settings') loadStoreSettings();
}

function refreshAdminData(){
  loadAdminData();
  var btn = (typeof event !== 'undefined' && event && event.target) ? event.target : null;
  if(btn){
    btn.textContent='✓ تم التحديث';
    setTimeout(function(){btn.textContent='🔄 تحديث'},900);
  }
}

/* ---------- Safe LocalStorage Helper ---------- */
function safeSetItem(key, val){
  try{
    localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
    return true;
  }catch(err){
    console.error('LocalStorage save error on key:', key, err);
    alert('⚠️ تنبيه: مساحة تخزين المتصفح ممتلئة! يرجى حذف بعض الطلبات أو تقليل حجم وعدد الصور المرفوعة.');
    return false;
  }
}

/* ---------- Orders Storage (removed - WhatsApp only mode) ---------- */
/* buyNow sends directly to WhatsApp, no local order tracking needed */

/* ==========================================
   ADMIN PANEL: SUB-MODALS, SERIES & PRODUCT MANAGEMENT
   ========================================== */

/* ---------- Sub-Modal Controls ---------- */
function openAdminSubModal(modalId){
  var modal=document.getElementById(modalId);
  if(modal) modal.classList.add('open');
}
function closeAdminSubModal(modalId){
  var modal=document.getElementById(modalId);
  if(modal) modal.classList.remove('open');
}
function closeAdminSubModalIfOutside(e, modalId){
  if(e.target.id===modalId) closeAdminSubModal(modalId);
}

/* ---------- Custom Series Management ---------- */
function getCustomSeries(){
  try{
    return JSON.parse(localStorage.getItem('mstore_custom_series')) || [];
  }catch(e){return [];}
}

function saveCustomSeries(seriesList){
  safeSetItem('mstore_custom_series', seriesList);
  renderCustomSeriesToCatalog();
  renderDrawerSeriesLinks();
  renderAdminProducts();
  renderAdminSeriesTable();
}

function openAddSeriesModal(){
  document.getElementById('newSeriesTitle').value='';
  document.getElementById('newSeriesBadge').value='جديد';
  document.getElementById('newSeriesId').value='';
  openAdminSubModal('adminAddSeriesModal');
}

function saveNewSeries(){
  var title=document.getElementById('newSeriesTitle').value.trim();
  var badge=document.getElementById('newSeriesBadge').value.trim();
  var id=document.getElementById('newSeriesId').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'');
  
  if(!title){alert('يرجى إدخال اسم القسم / السلسلة');return;}
  if(!id){alert('يرجى إدخال معرّف القسم بالإنجليزية (بدون مسافات)');return;}
  
  var list=getCustomSeries();
  if(list.some(function(s){return s.id===id})){
    alert('معرّف القسم هذا موجود مسبقاً! يرجى اختيار معرّف آخر.');
    return;
  }
  
  list.push({id: id, title: title, badge: badge||'جديد'});
  saveCustomSeries(list);
  closeAdminSubModal('adminAddSeriesModal');
  alert('تمت إضافة القسم الجديد "'+title+'" بنجاح! 🚀');
}

function deleteCustomSeries(id){
  if(confirm('هل أنت متأكد من حذف هذا القسم وجميع أجهزته التابعة له؟')){
    var list=getCustomSeries().filter(function(s){return s.id!==id});
    saveCustomSeries(list);
    var pList=getCustomProducts().filter(function(p){return p.seriesId!==id});
    saveCustomProducts(pList);
    var el=document.getElementById(id);
    if(el) el.remove();
    renderDrawerSeriesLinks();
    renderAdminProducts();
    renderAdminSeriesTable();
  }
}

function renderAdminSeriesTable(){
  var tbody = document.getElementById('adminSeriesTable');
  if(!tbody) return;
  tbody.innerHTML = '';
  var list = getCustomSeries();
  var customProds = getCustomProducts();
  
  if(list.length === 0){
    var tr = document.createElement('tr');
    var td = document.createElement('td');
    td.colSpan = 5;
    td.style.cssText = 'text-align:center;padding:24px;color:#777;font-size:13px';
    td.textContent = 'لم تقم بإنشاء أي أقسام مخصصة بعد. انقر على زر "➕ إضافة قسم جديد" بالأعلى لإنشاء قسم (مثال: أجهزة سامسونج).';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  
  list.forEach(function(s){
    var tr = document.createElement('tr');
    
    // 1. Title
    var tdTitle = document.createElement('td');
    var strong = document.createElement('strong');
    strong.style.color = '#fff';
    strong.textContent = s.title;
    tdTitle.appendChild(strong);
    
    // 2. ID
    var tdId = document.createElement('td');
    var code = document.createElement('code');
    code.style.cssText = 'color:var(--gold);background:#050505;padding:3px 8px;border-radius:6px;font-size:11px;border:1px solid #222';
    code.textContent = s.id;
    tdId.appendChild(code);
    
    // 3. Badge
    var tdBadge = document.createElement('td');
    var bSpan = document.createElement('span');
    bSpan.className = 'new-badge';
    bSpan.textContent = s.badge || 'جديد';
    tdBadge.appendChild(bSpan);
    
    // 4. Product count
    var count = customProds.filter(function(p){ return p.seriesId === s.id; }).length;
    var tdCount = document.createElement('td');
    tdCount.style.cssText = 'color:#ddd;font-weight:700';
    tdCount.textContent = count + ' جهاز';
    
    // 5. Actions
    var tdActions = document.createElement('td');
    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'admin-sm-btn danger';
    delBtn.textContent = '🗑️ حذف القسم';
    delBtn.title = 'حذف هذا القسم وجميع الأجهزة التابعة له';
    delBtn.onclick = function(){ deleteCustomSeries(s.id); };
    tdActions.appendChild(delBtn);
    
    tr.appendChild(tdTitle);
    tr.appendChild(tdId);
    tr.appendChild(tdBadge);
    tr.appendChild(tdCount);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
}

/* ---------- Custom Products Management ---------- */
function getCustomProducts(){
  try{
    return JSON.parse(localStorage.getItem('mstore_custom_products')) || [];
  }catch(e){return [];}
}

function saveCustomProducts(prodList){
  safeSetItem('mstore_custom_products', prodList);
  renderCustomProductsToCatalog();
  renderAdminProducts();
}

/* ==========================================
   INTERACTIVE COLOR & STORAGE BUILDER LOGIC
   ========================================== */

var APPLE_COLOR_PRESETS = [
  {label:'تيتانيوم طبيعي', code:'#8b8b8b'},
  {label:'أسود فضائي', code:'#2b2b2b'},
  {label:'أبيض تيتانيوم', code:'#e9e6de'},
  {label:'تيتانيوم صحراوي', code:'#cbb59d'},
  {label:'أزرق داكن', code:'#2e3a52'},
  {label:'برتقالي كوزمك', code:'#c4622f'},
  {label:'أخضر زمردي', code:'#2d5045'},
  {label:'بنفسجي عميق', code:'#594f63'},
  {label:'أحمر Product(RED)', code:'#ba0c2f'},
  {label:'ذهبي فاخر', code:'#e5d1b8'}
];

var APPLE_STORAGE_PRESETS = [
  {size:'64GB', defaultAdd:0},
  {size:'128GB', defaultAdd:0},
  {size:'256GB', defaultAdd:350},
  {size:'512GB', defaultAdd:750},
  {size:'1TB', defaultAdd:1400},
  {size:'2TB', defaultAdd:2200}
];

var APPLE_CONDITION_PRESETS = [
  {label:'جديد'},
  {label:'كرتونة مفتوحة'},
  {label:'مستعمل ممتاز'},
  {label:'مستعمل A+'},
  {label:'جيد جداً'},
  {label:'مبدل قطعة أصلية'},
  {label:'مبدل قطعة غير أصلية'},
  {label:'AG'}
];

var builderState = {
  edit: { colors: [], storages: [], conditions: [] },
  new: { colors: [], storages: [], conditions: [] }
};

/* Color Builder Helpers */
function initColorPresets(prefix){
  var box = document.getElementById(prefix + 'ColorPresets');
  if(!box) return;
  box.innerHTML = '';
  APPLE_COLOR_PRESETS.forEach(function(p){
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'builder-preset-btn';
    
    var dot = document.createElement('span');
    dot.className = 'color-dot-sm';
    dot.style.background = p.code;
    
    var txt = document.createTextNode(' ' + p.label);
    btn.appendChild(dot);
    btn.appendChild(txt);
    btn.onclick = function(){ addColorToBuilder(prefix, p.label, p.code); };
    box.appendChild(btn);
  });
}

function renderActiveColors(prefix){
  var box = document.getElementById(prefix + 'ActiveColors');
  if(!box) return;
  box.innerHTML = '';
  builderState[prefix].colors.forEach(function(c, idx){
    var pill = document.createElement('div');
    pill.className = 'color-tag-pill';
    
    var dot = document.createElement('span');
    dot.className = 'color-dot-sm';
    dot.style.background = c.code;
    
    var label = document.createElement('span');
    label.textContent = c.label;
    
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'remove-btn';
    btn.title = 'حذف هذا اللون';
    btn.textContent = '✕';
    btn.onclick = function(){ removeColorFromBuilder(prefix, idx); };
    
    pill.appendChild(dot);
    pill.appendChild(label);
    pill.appendChild(btn);
    box.appendChild(pill);
  });
}

function addColorToBuilder(prefix, label, code){
  var exists = builderState[prefix].colors.some(function(c){ return c.label.trim() === label.trim(); });
  if(!exists){
    builderState[prefix].colors.push({ label: label.trim(), code: code.trim() });
    renderActiveColors(prefix);
  }
}

function removeColorFromBuilder(prefix, idx){
  builderState[prefix].colors.splice(idx, 1);
  renderActiveColors(prefix);
}

function addCustomColorFromInput(prefix){
  var pPicker = document.getElementById(prefix + 'CustomColorPicker');
  var pName = document.getElementById(prefix + 'CustomColorName');
  var code = pPicker ? pPicker.value : '#8b8b8b';
  var name = pName ? pName.value.trim() : '';
  if(!name){ alert('يرجى كتابة اسم اللون المخصص'); return; }
  addColorToBuilder(prefix, name, code);
  if(pName) pName.value = '';
}

/* Storage Builder Helpers */
function initStoragePresets(prefix){
  var box = document.getElementById(prefix + 'StoragePresets');
  if(!box) return;
  box.innerHTML = '';
  APPLE_STORAGE_PRESETS.forEach(function(p){
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'builder-preset-btn';
    btn.textContent = '💾 ' + p.size;
    btn.onclick = function(){ addStorageToBuilder(prefix, p.size, p.defaultAdd); };
    box.appendChild(btn);
  });
}

function renderActiveStorages(prefix){
  var box = document.getElementById(prefix + 'ActiveStorages');
  if(!box) return;
  box.innerHTML = '';
  builderState[prefix].storages.forEach(function(s, idx){
    var row = document.createElement('div');
    row.className = 'storage-row-item';
    
    var badge = document.createElement('div');
    badge.className = 'storage-size-badge';
    badge.textContent = '📦 ' + s.size;
    
    var inputWrap = document.createElement('div');
    inputWrap.className = 'storage-price-input-wrap';
    
    var lbl = document.createElement('label');
    lbl.textContent = 'الزيادة على السعر الأساسي:';
    
    var inp = document.createElement('input');
    inp.type = 'number';
    inp.value = s.add;
    inp.min = '0';
    inp.oninput = function(){ updateStoragePriceInBuilder(prefix, idx, this.value); };
    
    var currency = document.createElement('span');
    currency.style.cssText = 'font-size:11px;color:var(--gold);font-weight:700';
    currency.textContent = 'AED +';
    
    inputWrap.appendChild(lbl);
    inputWrap.appendChild(inp);
    inputWrap.appendChild(currency);
    
    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '✕ حذف';
    removeBtn.onclick = function(){ removeStorageFromBuilder(prefix, idx); };
    
    row.appendChild(badge);
    row.appendChild(inputWrap);
    row.appendChild(removeBtn);
    box.appendChild(row);
  });
}

function addStorageToBuilder(prefix, size, add){
  var exists = builderState[prefix].storages.some(function(s){ return s.size.trim().toLowerCase() === size.trim().toLowerCase(); });
  if(!exists){
    builderState[prefix].storages.push({ size: size.trim(), add: parseInt(add, 10) || 0 });
    renderActiveStorages(prefix);
  }
}

function removeStorageFromBuilder(prefix, idx){
  builderState[prefix].storages.splice(idx, 1);
  renderActiveStorages(prefix);
}

function updateStoragePriceInBuilder(prefix, idx, val){
  if(builderState[prefix].storages[idx]){
    builderState[prefix].storages[idx].add = parseInt(val, 10) || 0;
  }
}

function addCustomStorageFromInput(prefix){
  var pSize = document.getElementById(prefix + 'CustomStorageSize');
  var pAdd = document.getElementById(prefix + 'CustomStorageAdd');
  var size = pSize ? pSize.value.trim() : '';
  var add = pAdd ? (parseInt(pAdd.value, 10) || 0) : 0;
  if(!size){ alert('يرجى إدخال حجم السعة (مثال: 4TB)'); return; }
  addStorageToBuilder(prefix, size, add);
  if(pSize) pSize.value = '';
  if(pAdd) pAdd.value = '';
}

/* Condition Builder Helpers */
function initConditionPresets(prefix){
  var box = document.getElementById(prefix + 'ConditionPresets');
  if(!box) return;
  box.innerHTML = '';
  APPLE_CONDITION_PRESETS.forEach(function(p){
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'builder-preset-btn';
    btn.textContent = '✨ ' + p.label;
    btn.onclick = function(){
      var defaultBase = parseInt(document.getElementById(prefix + 'ProdPrice').value, 10) || 5000;
      addConditionToBuilder(prefix, p.label, defaultBase);
    };
    box.appendChild(btn);
  });
}

function renderActiveConditions(prefix){
  var box = document.getElementById(prefix + 'ActiveConditions');
  if(!box) return;
  box.innerHTML = '';
  builderState[prefix].conditions.forEach(function(c, idx){
    var row = document.createElement('div');
    row.className = 'storage-row-item';
    
    var badge = document.createElement('div');
    badge.className = 'storage-size-badge';
    badge.style.minWidth = '130px';
    badge.textContent = '🏷️ ' + c.label;
    
    var inputWrap = document.createElement('div');
    inputWrap.className = 'storage-price-input-wrap';
    
    var lbl = document.createElement('label');
    lbl.textContent = 'السعر الأساسي:';
    
    var inp = document.createElement('input');
    inp.type = 'number';
    inp.value = c.price;
    inp.min = '0';
    inp.oninput = function(){ updateConditionPriceInBuilder(prefix, idx, this.value); };
    
    var currency = document.createElement('span');
    currency.style.cssText = 'font-size:11px;color:var(--gold);font-weight:700';
    currency.textContent = 'AED';
    
    inputWrap.appendChild(lbl);
    inputWrap.appendChild(inp);
    inputWrap.appendChild(currency);
    
    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '✕ حذف';
    removeBtn.onclick = function(){ removeConditionFromBuilder(prefix, idx); };
    
    row.appendChild(badge);
    row.appendChild(inputWrap);
    row.appendChild(removeBtn);
    box.appendChild(row);
  });
}

function addConditionToBuilder(prefix, label, price){
  var exists = builderState[prefix].conditions.some(function(c){
    return c.label.trim().toLowerCase() === label.trim().toLowerCase();
  });
  if(!exists){
    builderState[prefix].conditions.push({ label: label.trim(), price: parseInt(price, 10) || 0 });
    renderActiveConditions(prefix);
  }
}

function removeConditionFromBuilder(prefix, idx){
  builderState[prefix].conditions.splice(idx, 1);
  renderActiveConditions(prefix);
}

function updateConditionPriceInBuilder(prefix, idx, val){
  if(builderState[prefix].conditions[idx]){
    builderState[prefix].conditions[idx].price = parseInt(val, 10) || 0;
  }
}

function addCustomConditionFromInput(prefix){
  var pName = document.getElementById(prefix + 'CustomConditionName');
  var pPrice = document.getElementById(prefix + 'CustomConditionPrice');
  var name = pName ? pName.value.trim() : '';
  var price = pPrice ? (parseInt(pPrice.value, 10) || 0) : 0;
  if(!name){ alert('يرجى كتابة اسم الحالة (مثال: مستعمل A+ أو كرتونة مفتوحة)'); return; }
  addConditionToBuilder(prefix, name, price);
  if(pName) pName.value = '';
  if(pPrice) pPrice.value = '';
}

/* ---------- Product Images Gallery Management (Admin) ---------- */
window.productImagesState = { new: [], edit: [] };

function handleProductFilesChosen(event, mode){
  var files = event.target.files;
  if(!files || files.length === 0) return;
  
  Array.from(files).forEach(function(file){
    if(!file.type.match('image.*')) return;
    var reader = new FileReader();
    reader.onload = function(e){
      var img = new Image();
      img.onload = function(){
        var canvas = document.createElement('canvas');
        var maxDim = 700;
        var width = img.width;
        var height = img.height;
        if(width > height){
          if(width > maxDim){
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          }
        } else {
          if(height > maxDim){
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        var compressedData = canvas.toDataURL('image/jpeg', 0.85);
        
        if(!productImagesState[mode]) productImagesState[mode] = [];
        productImagesState[mode].push(compressedData);
        renderImagePreviews(mode);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
  event.target.value = '';
}

function addImageFromUrlInput(mode){
  var inp = document.getElementById(mode + 'ProdImgUrl');
  if(!inp) return;
  var url = inp.value.trim();
  if(!url){ alert('يرجى إدخال رابط الصورة أولاً'); return; }
  if(!productImagesState[mode]) productImagesState[mode] = [];
  productImagesState[mode].push(url);
  inp.value = '';
  renderImagePreviews(mode);
}

function removeImageFromPreview(mode, idx){
  if(productImagesState[mode]){
    productImagesState[mode].splice(idx, 1);
    renderImagePreviews(mode);
  }
}

function makeImagePrimary(mode, idx){
  if(productImagesState[mode] && idx > 0 && idx < productImagesState[mode].length){
    var item = productImagesState[mode].splice(idx, 1)[0];
    productImagesState[mode].unshift(item);
    renderImagePreviews(mode);
  }
}

function renderImagePreviews(mode){
  var strip = document.getElementById(mode + 'ImagesPreviewStrip');
  if(!strip) return;
  strip.innerHTML = '';
  var list = productImagesState[mode] || [];
  
  if(list.length === 0){
    var emptyMsg = document.createElement('div');
    emptyMsg.style.cssText = 'color:#666;font-size:12px;padding:8px 4px';
    emptyMsg.textContent = 'لم يتم اختيار صور بعد. يمكنك النقر على زر "اختيار صور" لإضافة صور من جهازك أو إضافة روابط.';
    strip.appendChild(emptyMsg);
    return;
  }
  
  list.forEach(function(src, i){
    var card = document.createElement('div');
    card.className = 'img-preview-card' + (i === 0 ? ' primary' : '');
    card.title = i === 0 ? 'الصورة الرئيسية للمنتج' : 'انقر لتعيينها كصورة رئيسية';
    
    var img = document.createElement('img');
    img.src = src;
    img.alt = '';
    card.appendChild(img);
    
    var badge = document.createElement('span');
    badge.className = 'img-preview-badge';
    badge.textContent = i === 0 ? '⭐ رئيسية' : '#' + (i + 1);
    card.appendChild(badge);
    
    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'img-preview-del';
    delBtn.textContent = '×';
    delBtn.title = 'حذف الصورة';
    delBtn.onclick = function(e){
      e.stopPropagation();
      removeImageFromPreview(mode, i);
    };
    card.appendChild(delBtn);
    
    if(i > 0){
      card.style.cursor = 'pointer';
      card.onclick = function(){ makeImagePrimary(mode, i); };
    }
    
    strip.appendChild(card);
  });
}

/* ---------- Add Product Modal Logic ---------- */
function openAddProductModal(){
  var select = document.getElementById('newProdSeriesSelect');
  if(select){
    select.innerHTML = '';
    document.querySelectorAll('#catalog .catalog-section').forEach(function(sec){
      var sid = sec.id;
      var titleEl = sec.querySelector('.catalog-title h3') || sec.querySelector('h3') || sec.querySelector('h2');
      var title = titleEl ? titleEl.textContent.replace(/جديد|‹|›|عرض الكل/g,'').trim() : sid;
      var opt = document.createElement('option');
      opt.value = sid;
      opt.textContent = title;
      select.appendChild(opt);
    });
    getCustomSeries().forEach(function(cs){
      if(!select.querySelector('option[value="'+cs.id+'"]')){
        var opt = document.createElement('option');
        opt.value = cs.id;
        opt.textContent = cs.title;
        select.appendChild(opt);
      }
    });
  }
  document.getElementById('newProdName').value = '';
  document.getElementById('newProdPrice').value = '5199';
  document.getElementById('newProdBadge').value = 'جديد';
  if(document.getElementById('newProdSpecOS')) document.getElementById('newProdSpecOS').value = 'iOS 18';
  document.getElementById('newProdSpecScreen').value = '6.9 بوصة Super Retina XDR';
  document.getElementById('newProdSpecChip').value = 'A19 Pro / Bionic';
  document.getElementById('newProdSpecCamera').value = '48MP + 48MP + 12MP';
  document.getElementById('newProdSpecBattery').value = 'حتى 33 ساعة تشغيل فيديو';
  document.getElementById('newProdAbout').value = '';

  productImagesState.new = [];
  renderImagePreviews('new');

  builderState.new.colors = [
    {label:'تيتانيوم طبيعي', code:'#8b8b8b'},
    {label:'أسود فضائي', code:'#2b2b2b'},
    {label:'أبيض تيتانيوم', code:'#e9e6de'}
  ];
  builderState.new.storages = [
    {size:'256GB', add:0},
    {size:'512GB', add:400},
    {size:'1TB', add:800}
  ];
  builderState.new.conditions = [
    {label:'جديد', price:5199},
    {label:'كرتونة مفتوحة', price:4899},
    {label:'مستعمل ممتاز', price:4599},
    {label:'جيد جداً', price:4199}
  ];

  initColorPresets('new');
  initStoragePresets('new');
  initConditionPresets('new');
  renderActiveColors('new');
  renderActiveStorages('new');
  renderActiveConditions('new');

  openAdminSubModal('adminAddProductModal');
}

function saveNewProduct(){
  var name = document.getElementById('newProdName').value.trim();
  var seriesId = document.getElementById('newProdSeriesSelect').value;
  var price = parseInt(document.getElementById('newProdPrice').value,10) || 0;
  var badge = document.getElementById('newProdBadge') ? document.getElementById('newProdBadge').value.trim() : '';
  var os = (document.getElementById('newProdSpecOS') ? document.getElementById('newProdSpecOS').value.trim() : '') || 'iOS 18';
  var screen = document.getElementById('newProdSpecScreen').value.trim();
  var chip = document.getElementById('newProdSpecChip').value.trim();
  var camera = document.getElementById('newProdSpecCamera').value.trim();
  var battery = document.getElementById('newProdSpecBattery').value.trim();
  var about = document.getElementById('newProdAbout').value.trim();
  
  if(!name){ alert('يرجى إدخال اسم الجهاز'); return; }
  if(price <= 0){ alert('يرجى إدخال سعر صحيح'); return; }
  
  var imgs = (productImagesState.new && productImagesState.new.length > 0) ? productImagesState.new.slice() : ['https://commons.wikimedia.org/wiki/Special:Redirect/file/IPhone_17_Pro.png'];
  var mainImg = imgs[0];
  
  var colors = builderState.new.colors.length > 0 ? builderState.new.colors : [
    {label:'تيتانيوم طبيعي', code:'#8b8b8b'},
    {label:'أسود فضائي', code:'#2b2b2b'},
    {label:'أبيض تيتانيوم', code:'#e9e6de'}
  ];
  var storages = builderState.new.storages.length > 0 ? builderState.new.storages : [
    {size:'256GB', add:0},
    {size:'512GB', add:400},
    {size:'1TB', add:800}
  ];
  var conditions = builderState.new.conditions.length > 0 ? builderState.new.conditions : [
    {label:'جديد', price: price}
  ];

  var newP = {
    id: 'prod_' + Date.now(),
    name: name,
    seriesId: seriesId,
    price: price,
    badge: badge,
    os: os,
    conditions: conditions,
    img: mainImg,
    images: imgs,
    desc: about
  };
  
  var pList = getCustomProducts();
  pList.push(newP);
  saveCustomProducts(pList);
  
  var allDetails = getAllProductDetails();
  allDetails[name] = {
    name: name,
    price: price,
    badge: badge,
    os: os,
    conditions: conditions,
    img: mainImg,
    images: imgs,
    about: about || ('يأتي ' + name + ' بتصميم أنيق وأداء فائق مع أفضل المواصفات لتجربة استخدام استثنائية.'),
    screen: screen || 'Super Retina XDR',
    chip: chip || 'A19 Pro / Bionic',
    camera: camera || 'نظام كاميرات احترافي بدقة 48MP',
    battery: battery || 'بطارية تدوم حتى 33 ساعة',
    colors: colors,
    storages: storages
  };
  safeSetItem('mstore_product_details', allDetails);
  
  closeAdminSubModal('adminAddProductModal');
  renderAdminProducts();
  alert('تمت إضافة الجهاز الجديد "' + name + '" بنجاح مع كامل الصور والتفاصيل! 📱✨');
}

function deleteCustomProduct(id, name){
  if(confirm('هل أنت متأكد من حذف هذا الجهاز "' + name + '"؟')){
    var list = getCustomProducts().filter(function(p){ return p.id !== id && p.name !== name; });
    saveCustomProducts(list);
    var el = document.getElementById(id);
    if(el) el.remove();
    renderAdminProducts();
  }
}

/* ---------- Render Custom Series & Products to Store Catalog ---------- */
function renderCustomSeriesToCatalog(){
  var catPage = document.getElementById('catalog');
  if(!catPage) return;
  var customSeries = getCustomSeries();
  
  customSeries.forEach(function(cs){
    if(!document.getElementById(cs.id)){
      var sec = document.createElement('div');
      sec.className = 'catalog-section';
      sec.id = cs.id;
      
      var catTitle = document.createElement('div');
      catTitle.className = 'catalog-title';
      
      var h3Div = document.createElement('div');
      var h3 = document.createElement('h3');
      h3.textContent = cs.title + ' ';
      var nBadge = document.createElement('span');
      nBadge.className = 'new-badge';
      nBadge.textContent = cs.badge;
      h3.appendChild(nBadge);
      h3Div.appendChild(h3);
      
      var actDiv = document.createElement('div');
      actDiv.className = 'title-actions';
      
      catTitle.appendChild(h3Div);
      catTitle.appendChild(actDiv);
      
      var grid = document.createElement('div');
      grid.className = 'products-grid';
      grid.id = 'grid-' + cs.id;
      
      sec.appendChild(catTitle);
      sec.appendChild(grid);
      
      var backBtn = catPage.querySelector('.back-top');
      if(backBtn){
        catPage.insertBefore(sec, backBtn);
      } else {
        catPage.appendChild(sec);
      }
    }
  });
  renderCustomProductsToCatalog();
  renderDrawerSeriesLinks();
}

function renderDrawerSeriesLinks(){
  var container = document.getElementById('drawerSeriesLinks');
  var header = document.querySelector('.drawer-series-header');
  if(!container) return;
  container.innerHTML = '';
  
  var customSeries = getCustomSeries();
  if(!customSeries || customSeries.length === 0){
    if(header) header.style.display = 'none';
    return;
  }
  
  if(header) header.style.display = 'block';
  
  customSeries.forEach(function(cs){
    var a = document.createElement('a');
    a.href = '#' + cs.id;
    a.innerHTML = '<span>' + cs.title + '</span><span style="color:var(--gold);font-weight:900">←</span>';
    a.onclick = function(e){
      if(e) e.preventDefault();
      var menu = document.getElementById('menu');
      if(menu) menu.classList.remove('open');
      goToCatalog(e, cs.id);
    };
    container.appendChild(a);
  });
}

function renderCustomProductsToCatalog(){
  var customProds = getCustomProducts();
  customProds.forEach(function(p){
    var grid = document.getElementById('grid-' + p.seriesId);
    if(grid && !document.getElementById(p.id)){
      var card = document.createElement('article');
      card.className = 'product-card';
      card.id = p.id;
      
      if(p.badge){
        var bSpan = document.createElement('span');
        bSpan.className = 'product-card-badge';
        bSpan.textContent = p.badge;
        card.appendChild(bSpan);
      }
      
      var imgDiv = document.createElement('div');
      imgDiv.className = 'product-image';
      var img = document.createElement('img');
      img.className = 'product-img';
      img.src = p.img;
      img.alt = p.name;
      img.loading = 'lazy';
      imgDiv.appendChild(img);
      
      var nameDiv = document.createElement('div');
      nameDiv.className = 'product-name';
      nameDiv.textContent = p.name;
      
      var priceDiv = document.createElement('div');
      priceDiv.className = 'product-price';
      priceDiv.textContent = p.price.toLocaleString('en-US') + ' AED';
      
      var actDiv = document.createElement('div');
      actDiv.className = 'card-actions';
      
      var vLink = document.createElement('a');
      vLink.className = 'view-device';
      vLink.href = '#product';
      vLink.textContent = 'عرض التفاصيل ←';
      vLink.onclick = function(e){ openProduct(vLink, e); };
      
      card.appendChild(imgDiv);
      card.appendChild(nameDiv);
      card.appendChild(priceDiv);
      card.appendChild(vLink);
      grid.appendChild(card);
    }
  });
}
renderCustomSeriesToCatalog();
renderDrawerSeriesLinks();

/* ---------- Edit Full Product Details Modal Logic ---------- */
function openEditProductModal(prodName){
  var allDetails = getAllProductDetails();
  var overrides = getProductOverrides();
  var d = allDetails[prodName] || {};
  
  var card = null;
  document.querySelectorAll('.product-card').forEach(function(c){
    if(c.querySelector('.product-name').textContent.trim() === prodName) card = c;
  });
  var curPrice = (overrides[prodName] && overrides[prodName].price) ? overrides[prodName].price : (card ? parseInt(card.querySelector('.product-price').textContent.replace(/[^\d]/g,''),10) || 4999 : 4999);
  var curImg = d.img || (card ? card.querySelector('.product-img').src : '');
  
  document.getElementById('editModalProdTitle').textContent = prodName;
  document.getElementById('editProdOriginalName').value = prodName;
  document.getElementById('editProdName').value = d.name || prodName;
  document.getElementById('editProdPrice').value = d.price || curPrice;
  if(document.getElementById('editProdBadge')) document.getElementById('editProdBadge').value = d.badge || '';
  if(document.getElementById('editProdSpecOS')) document.getElementById('editProdSpecOS').value = d.os || 'iOS 18';
  document.getElementById('editProdSpecScreen').value = d.screen || '6.9 بوصة Super Retina XDR';
  document.getElementById('editProdSpecChip').value = d.chip || 'A19 Pro / Bionic';
  document.getElementById('editProdSpecCamera').value = d.camera || '48MP + 48MP + 12MP';
  document.getElementById('editProdSpecBattery').value = d.battery || 'حتى 33 ساعة تشغيل فيديو';
  document.getElementById('editProdAbout').value = d.about || ('يأتي ' + prodName + ' بتصميم أنيق وأداء فائق مع أفضل المواصفات لتجربة استخدام استثنائية.');
  
  var existingImages = (d.images && Array.isArray(d.images) && d.images.length > 0) ? d.images.slice() : (curImg ? [curImg] : []);
  productImagesState.edit = existingImages;
  renderImagePreviews('edit');

  builderState.edit.colors = (d.colors && d.colors.length > 0) ? JSON.parse(JSON.stringify(d.colors)) : [
    {label:'أسود فضائي', code:'#3a3a3a'},
    {label:'تيتانيوم طبيعي', code:'#8b8b8b'},
    {label:'أبيض تيتانيوم', code:'#e9e6de'},
    {label:'أزرق داكن', code:'#2e3a52'},
    {label:'برتقالي كوزمك', code:'#c4622f'}
  ];
  initColorPresets('edit');
  renderActiveColors('edit');

  builderState.edit.storages = (d.storages && d.storages.length > 0) ? JSON.parse(JSON.stringify(d.storages)) : [
    {size:'256GB', add:0},
    {size:'512GB', add:400},
    {size:'1TB', add:800},
    {size:'2TB', add:1600}
  ];
  initStoragePresets('edit');
  renderActiveStorages('edit');

  builderState.edit.conditions = (d.conditions && Array.isArray(d.conditions) && d.conditions.length > 0) ? JSON.parse(JSON.stringify(d.conditions)) : [
    {label:'جديد', price: (d.price || curPrice)},
    {label:'كرتونة مفتوحة', price: Math.round((d.price || curPrice) * 0.95)},
    {label:'مستعمل ممتاز', price: Math.round((d.price || curPrice) * 0.88)},
    {label:'جيد جداً', price: Math.round((d.price || curPrice) * 0.80)}
  ];
  initConditionPresets('edit');
  renderActiveConditions('edit');

  // Populate series dropdown in Edit Product modal
  var select = document.getElementById('editProdSeriesSelect');
  var currentSeriesId = '';
  if(card){
    var sec = card.closest('.catalog-section');
    if(sec) currentSeriesId = sec.id;
  }
  var customProds = getCustomProducts();
  var foundCustom = customProds.find(function(p){ return p.name === prodName; });
  if(foundCustom && foundCustom.seriesId){
    currentSeriesId = foundCustom.seriesId;
  }
  
  if(select){
    select.innerHTML = '';
    document.querySelectorAll('#catalog .catalog-section').forEach(function(sec){
      var sid = sec.id;
      var titleEl = sec.querySelector('.catalog-title h3') || sec.querySelector('h3') || sec.querySelector('h2');
      var title = titleEl ? titleEl.textContent.replace(/جديد|‹|›|عرض الكل/g,'').trim() : sid;
      var opt = document.createElement('option');
      opt.value = sid;
      opt.textContent = title;
      if(sid === currentSeriesId) opt.selected = true;
      select.appendChild(opt);
    });
    getCustomSeries().forEach(function(cs){
      if(!select.querySelector('option[value="'+cs.id+'"]')){
        var opt = document.createElement('option');
        opt.value = cs.id;
        opt.textContent = cs.title;
        if(cs.id === currentSeriesId) opt.selected = true;
        select.appendChild(opt);
      }
    });
    if(currentSeriesId) select.value = currentSeriesId;
  }

  openAdminSubModal('adminEditProductModal');
}

function saveCustomProductDetails(){
  var origName = document.getElementById('editProdOriginalName').value;
  var newName = document.getElementById('editProdName').value.trim() || origName;
  var price = parseInt(document.getElementById('editProdPrice').value,10) || 0;
  var badge = document.getElementById('editProdBadge') ? document.getElementById('editProdBadge').value.trim() : '';
  var os = (document.getElementById('editProdSpecOS') ? document.getElementById('editProdSpecOS').value.trim() : '') || 'iOS 18';
  var newSeriesId = document.getElementById('editProdSeriesSelect') ? document.getElementById('editProdSeriesSelect').value : '';
  var screen = document.getElementById('editProdSpecScreen').value.trim();
  var chip = document.getElementById('editProdSpecChip').value.trim();
  var camera = document.getElementById('editProdSpecCamera').value.trim();
  var battery = document.getElementById('editProdSpecBattery').value.trim();
  var about = document.getElementById('editProdAbout').value.trim();
  
  var imgs = (productImagesState.edit && productImagesState.edit.length > 0) ? productImagesState.edit.slice() : ['https://commons.wikimedia.org/wiki/Special:Redirect/file/IPhone_17_Pro.png'];
  var mainImg = imgs[0];

  var colors = builderState.edit.colors.length > 0 ? builderState.edit.colors : [
    {label:'تيتانيوم طبيعي', code:'#8b8b8b'},
    {label:'أسود فضائي', code:'#2b2b2b'},
    {label:'أبيض تيتانيوم', code:'#e9e6de'}
  ];
  var storages = builderState.edit.storages.length > 0 ? builderState.edit.storages : [
    {size:'256GB', add:0},
    {size:'512GB', add:400},
    {size:'1TB', add:800}
  ];
  var conditions = (builderState.edit.conditions && builderState.edit.conditions.length > 0) ? builderState.edit.conditions : [
    {label:'جديد', price: price}
  ];

  var allDetails = getAllProductDetails();
  allDetails[origName] = {
    name: newName,
    price: price,
    badge: badge,
    os: os,
    conditions: conditions,
    img: mainImg,
    images: imgs,
    screen: screen,
    chip: chip,
    camera: camera,
    battery: battery,
    colors: colors,
    storages: storages,
    about: about
  };
  if(newName !== origName){
    allDetails[newName] = allDetails[origName];
  }
  safeSetItem('mstore_product_details', allDetails);
  
  if(price > 0){
    var overrides = getProductOverrides();
    if(!overrides[origName]) overrides[origName] = {};
    overrides[origName].price = price;
    if(newName !== origName){
      if(!overrides[newName]) overrides[newName] = {};
      overrides[newName].price = price;
    }
    saveProductOverrides(overrides);
  }
  
  // If this product is a custom product, update its series and move it in catalog
  var pList = getCustomProducts();
  var pIdx = pList.findIndex(function(p){ return p.name === origName; });
  if(pIdx > -1){
    pList[pIdx].name = newName;
    pList[pIdx].price = price;
    pList[pIdx].badge = badge;
    pList[pIdx].os = os;
    pList[pIdx].conditions = conditions;
    pList[pIdx].img = mainImg;
    pList[pIdx].images = imgs;
    pList[pIdx].desc = about;
    if(newSeriesId && newSeriesId !== pList[pIdx].seriesId){
      pList[pIdx].seriesId = newSeriesId;
      var cardEl = document.getElementById(pList[pIdx].id);
      var targetGrid = document.getElementById('grid-' + newSeriesId);
      if(cardEl && targetGrid){
        targetGrid.appendChild(cardEl);
      }
    }
    saveCustomProducts(pList);
  }
  
  document.querySelectorAll('.product-card').forEach(function(c){
    var nEl = c.querySelector('.product-name');
    if(nEl && nEl.textContent.trim() === origName){
      if(newName !== origName) nEl.textContent = newName;
      if(mainImg) c.querySelector('.product-img').src = mainImg;
      var cBadge = c.querySelector('.product-card-badge');
      if(badge){
        if(!cBadge){
          cBadge = document.createElement('span');
          cBadge.className = 'product-card-badge';
          c.appendChild(cBadge);
        }
        cBadge.textContent = badge;
      } else if(cBadge){
        cBadge.remove();
      }
    }
  });
  
  closeAdminSubModal('adminEditProductModal');
  renderAdminProducts();
  alert('تم حفظ تفاصيل وصور الجهاز "' + newName + '" بنجاح! 💾');
}

/* ---------- Products Overrides & Pricing ---------- */
function getProductOverrides(){
  try{
    return JSON.parse(localStorage.getItem('mstore_product_overrides')) || {};
  }catch(e){ return {}; }
}

function saveProductOverrides(overrides){
  safeSetItem('mstore_product_overrides', overrides);
  applyProductOverridesToStore();
}

function applyProductOverridesToStore(){
  var overrides = getProductOverrides();
  var allDetails = getAllProductDetails();
  document.querySelectorAll('.product-card').forEach(function(card){
    var name = card.querySelector('.product-name').textContent.trim();
    if(allDetails[name] && allDetails[name].badge){
      var cBadge = card.querySelector('.product-card-badge');
      if(!cBadge){
        cBadge = document.createElement('span');
        cBadge.className = 'product-card-badge';
        card.appendChild(cBadge);
      }
      cBadge.textContent = allDetails[name].badge;
    }
    if(overrides[name]){
      if(overrides[name].price !== undefined){
        var priceEl = card.querySelector('.product-price');
        if(priceEl) priceEl.textContent = parseInt(overrides[name].price, 10).toLocaleString('en-US') + ' AED';
      }
      if(overrides[name].available !== undefined){
        card.style.opacity = overrides[name].available ? '1' : '.45';
      }
    }
  });
}
applyProductOverridesToStore();

/* ---------- Render Admin Products (Fixed & Enhanced DOM) ---------- */
function renderAdminProducts(query){
  var tbody = document.getElementById('adminProductsTable');
  if(!tbody) return;
  tbody.innerHTML = '';
  var overrides = getProductOverrides();
  var allDetails = getAllProductDetails();
  var cards = document.querySelectorAll('.product-card');
  
  cards.forEach(function(card){
    var name = card.querySelector('.product-name').textContent.trim();
    var section = card.closest('.catalog-section');
    var seriesTitleEl = section ? (section.querySelector('.catalog-title h3') || section.querySelector('h3') || section.querySelector('h2')) : null;
    var seriesName = seriesTitleEl ? seriesTitleEl.textContent.replace(/جديد|‹|›|عرض الكل/g,'').trim() : 'iPhone Series';
    
    var cardImg = card.querySelector('.product-img');
    var imgSrc = (allDetails[name] && allDetails[name].img) ? allDetails[name].img : (cardImg ? cardImg.src : '');
    
    var priceDigits = card.querySelector('.product-price').textContent.replace(/[^\d]/g,'');
    var currentPrice = parseInt(priceDigits, 10) || 0;
    var isAvail = (overrides[name] && overrides[name].available !== undefined) ? overrides[name].available : true;
    var isCustom = card.id && card.id.indexOf('prod_') === 0;
    
    if(query && name.toLowerCase().indexOf(query.toLowerCase()) === -1 && seriesName.toLowerCase().indexOf(query.toLowerCase()) === -1){
      return;
    }
    
    var tr = document.createElement('tr');
    
    // Col 1: Name & thumb
    var tdName = document.createElement('td');
    var thumb = document.createElement('img');
    thumb.className = 'thumb-mini';
    thumb.src = imgSrc;
    thumb.alt = '';
    var strong = document.createElement('strong');
    strong.textContent = name;
    tdName.appendChild(thumb);
    tdName.appendChild(strong);
    if(isCustom){
      var b = document.createElement('span');
      b.className = 'admin-badge-preview';
      b.textContent = 'مضاف';
      tdName.appendChild(b);
    }
    
    // Col 2: Series
    var tdSeries = document.createElement('td');
    var spanSeries = document.createElement('span');
    spanSeries.style.cssText = 'color:#aaa;font-size:11.5px';
    spanSeries.textContent = seriesName;
    tdSeries.appendChild(spanSeries);
    
    // Col 3: Price display
    var tdPrice = document.createElement('td');
    var bPrice = document.createElement('b');
    bPrice.style.color = 'var(--gold)';
    bPrice.textContent = currentPrice.toLocaleString('en-US') + ' AED';
    tdPrice.appendChild(bPrice);
    
    // Col 4: Price input
    var tdInp = document.createElement('td');
    var priceInp = document.createElement('input');
    priceInp.type = 'number';
    priceInp.className = 'admin-price-input';
    priceInp.setAttribute('data-name', name);
    priceInp.value = currentPrice;
    tdInp.appendChild(priceInp);
    
    // Col 5: Status tag
    var tdStatus = document.createElement('td');
    var sTag = document.createElement('span');
    sTag.className = 'admin-status-tag ' + (isAvail ? 'active' : 'inactive');
    sTag.textContent = isAvail ? 'متوفر' : 'غير متوفر';
    tdStatus.appendChild(sTag);
    
    // Col 6: Actions
    var tdActions = document.createElement('td');
    var actDiv = document.createElement('div');
    actDiv.className = 'admin-action-group';
    
    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'admin-sm-btn';
    editBtn.title = 'تعديل كافة التفاصيل والمواصفات';
    editBtn.textContent = '✏️ تعديل';
    editBtn.onclick = function(){ openEditProductModal(name); };
    actDiv.appendChild(editBtn);
    
    var toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'admin-sm-btn';
    toggleBtn.title = 'تغيير حالة التوفر';
    toggleBtn.textContent = isAvail ? 'تعطيل' : 'تفعيل';
    toggleBtn.onclick = function(){ toggleProductAvail(name); };
    actDiv.appendChild(toggleBtn);
    
    if(isCustom){
      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'admin-sm-btn danger';
      delBtn.title = 'حذف الجهاز';
      delBtn.textContent = '🗑️';
      delBtn.onclick = function(){ deleteCustomProduct(card.id, name); };
      actDiv.appendChild(delBtn);
    }
    
    tdActions.appendChild(actDiv);
    
    tr.appendChild(tdName);
    tr.appendChild(tdSeries);
    tr.appendChild(tdPrice);
    tr.appendChild(tdInp);
    tr.appendChild(tdStatus);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
  
  var pStat = document.getElementById('adminStatProducts');
  if(pStat) pStat.textContent = cards.length;
}

function filterAdminProducts(q){
  renderAdminProducts(q);
}

function toggleProductAvail(name){
  var overrides = getProductOverrides();
  if(!overrides[name]) overrides[name] = {};
  var cur = overrides[name].available !== undefined ? overrides[name].available : true;
  overrides[name].available = !cur;
  saveProductOverrides(overrides);
  renderAdminProducts(document.getElementById('adminProductSearch') ? document.getElementById('adminProductSearch').value : '');
}

function saveAllProductPrices(){
  var overrides = getProductOverrides();
  document.querySelectorAll('#adminProductsTable .admin-price-input').forEach(function(inp){
    var name = inp.getAttribute('data-name');
    var val = parseInt(inp.value, 10);
    if(name && !isNaN(val) && val > 0){
      if(!overrides[name]) overrides[name] = {};
      overrides[name].price = val;
    }
  });
  saveProductOverrides(overrides);
  renderAdminProducts(document.getElementById('adminProductSearch') ? document.getElementById('adminProductSearch').value : '');
  alert('تم حفظ جميع الأسعار وتحديث المتجر بنجاح! 💾');
}




/* ---------- WhatsApp Modal & Social Links Logic ---------- */
function openWhatsappModal(e){
  if(e && e.preventDefault) e.preventDefault();
  var modal = document.getElementById('whatsappChoiceModal');
  if(modal) modal.classList.add('open');
}

function closeWhatsappModal(){
  var modal = document.getElementById('whatsappChoiceModal');
  if(modal) modal.classList.remove('open');
}

function closeWhatsappModalIfOutside(e){
  if(e.target.id === 'whatsappChoiceModal') closeWhatsappModal();
}

function openWhatsappBranch(country){
  var egNum = localStorage.getItem('mstore_setting_whatsapp_eg') || '201000000000';
  var uaeNum = localStorage.getItem('mstore_setting_whatsapp_uae') || '971588385253';
  var num = (country === 'EG') ? egNum : uaeNum;
  var cleanNum = num.replace(/[^\d]/g, '');
  var textQuery = currentOrderMessage ? '?text=' + currentOrderMessage : '';
  window.open('https://wa.me/' + cleanNum + textQuery, '_blank');
  currentOrderMessage = '';
  closeWhatsappModal();
}

/* ---------- Store Settings Logic ---------- */
function loadStoreSettings(){
  var fb = localStorage.getItem('mstore_setting_facebook') || 'https://facebook.com';
  var tiktok = localStorage.getItem('mstore_setting_tiktok') || 'https://tiktok.com';
  var waEG = localStorage.getItem('mstore_setting_whatsapp_eg') || '201000000000';
  var waUAE = localStorage.getItem('mstore_setting_whatsapp_uae') || '971588385253';
  var eyebrow = localStorage.getItem('mstore_setting_eyebrow') || 'مرحباً بك في MSTORE، وجهتك الموثوقة لأجهزة iPhone';
  var heroTitle = localStorage.getItem('mstore_setting_hero_title') || 'أحدث أجهزة iPhone بأفضل الأسعار';
  
  if(document.getElementById('settingFacebook')) document.getElementById('settingFacebook').value = fb;
  if(document.getElementById('settingTiktok')) document.getElementById('settingTiktok').value = tiktok;
  if(document.getElementById('settingWhatsappEG')) document.getElementById('settingWhatsappEG').value = waEG;
  if(document.getElementById('settingWhatsappUAE')) document.getElementById('settingWhatsappUAE').value = waUAE;
  if(document.getElementById('settingEyebrow')) document.getElementById('settingEyebrow').value = eyebrow;
  if(document.getElementById('ghUsername')) document.getElementById('ghUsername').value = localStorage.getItem('mstore_setting_gh_user') || '';
  if(document.getElementById('ghRepo')) document.getElementById('ghRepo').value = localStorage.getItem('mstore_setting_gh_repo') || '';
  if(document.getElementById('ghToken')) document.getElementById('ghToken').value = localStorage.getItem('mstore_setting_gh_token') || '';
}

function applyStoreSettingsToPage(){
  var fb = localStorage.getItem('mstore_setting_facebook') || 'https://facebook.com';
  var tiktok = localStorage.getItem('mstore_setting_tiktok') || 'https://tiktok.com';
  var eyebrow = localStorage.getItem('mstore_setting_eyebrow');
  var heroTitle = localStorage.getItem('mstore_setting_hero_title');
  
  if(eyebrow){
    var el = document.querySelector('.hero .eyebrow');
    if(el) el.innerHTML = eyebrow.indexOf('MSTORE') > -1 ? eyebrow.replace('MSTORE','<span>MSTORE</span>') : eyebrow;
  }
  if(heroTitle){
    var elH = document.querySelector('.hero h1');
    if(elH) elH.innerHTML = heroTitle.indexOf('iPhone') > -1 ? heroTitle.replace('iPhone','<b>iPhone</b>') : heroTitle;
  }
  
  var btnFb = document.getElementById('btnFacebook');
  if(btnFb) btnFb.href = fb;
  
  var btnTt = document.getElementById('btnTiktok');
  if(btnTt) btnTt.href = tiktok;
}
applyStoreSettingsToPage();

function saveStoreSettings(){
  var fb = document.getElementById('settingFacebook').value.trim();
  var tiktok = document.getElementById('settingTiktok').value.trim();
  var waEG = document.getElementById('settingWhatsappEG').value.trim();
  var waUAE = document.getElementById('settingWhatsappUAE').value.trim();
  var eyebrow = document.getElementById('settingEyebrow').value.trim();
  var heroTitle = document.getElementById('settingHeroTitle').value.trim();
  var curPass = document.getElementById('settingCurrentPass').value.trim();
  var newPass = document.getElementById('settingNewPass').value.trim();
  
  localStorage.setItem('mstore_setting_facebook', fb || 'https://facebook.com');
  localStorage.setItem('mstore_setting_tiktok', tiktok || 'https://tiktok.com');
  localStorage.setItem('mstore_setting_whatsapp_eg', waEG || '201000000000');
  localStorage.setItem('mstore_setting_whatsapp_uae', waUAE || '971588385253');
  
  if(eyebrow) localStorage.setItem('mstore_setting_eyebrow', eyebrow);
  else localStorage.removeItem('mstore_setting_eyebrow');
  
  if(heroTitle) localStorage.setItem('mstore_setting_hero_title', heroTitle);
  else localStorage.removeItem('mstore_setting_hero_title');

  var ghU = document.getElementById('ghUsername') ? document.getElementById('ghUsername').value.trim() : '';
  var ghR = document.getElementById('ghRepo') ? document.getElementById('ghRepo').value.trim() : '';
  var ghT = document.getElementById('ghToken') ? document.getElementById('ghToken').value.trim() : '';
  if(ghU) localStorage.setItem('mstore_setting_gh_user', ghU);
  if(ghR) localStorage.setItem('mstore_setting_gh_repo', ghR);
  if(ghT) localStorage.setItem('mstore_setting_gh_token', ghT);
  
  if(newPass){
    if(curPass !== getAdminPassword()){
      alert('كلمة المرور الحالية غير صحيحة! لم يتم تغيير كلمة المرور.');
      return;
    } else {
      localStorage.setItem('mstore_admin_pass', newPass);
      document.getElementById('settingCurrentPass').value = '';
      document.getElementById('settingNewPass').value = '';
      alert('تم تغيير كلمة مرور لوحة التحكم بنجاح! 🔑');
    }
  }
  
  applyStoreSettingsToPage();

  alert('تم حفظ إعدادات المتجر بنجاح! ✅');
}

function resetDefaultSettings(){
  if(confirm('هل تريد استعادة الإعدادات الافتراضية للمتجر؟')){
    localStorage.removeItem('mstore_setting_facebook');
    localStorage.removeItem('mstore_setting_tiktok');
    localStorage.removeItem('mstore_setting_whatsapp_eg');
    localStorage.removeItem('mstore_setting_whatsapp_uae');
    localStorage.removeItem('mstore_setting_eyebrow');
    localStorage.removeItem('mstore_setting_hero_title');
    loadStoreSettings();
    applyStoreSettingsToPage();
    alert('تمت استعادة الإعدادات الافتراضية!');
  }
}

function loadAdminData(){
  renderAdminProducts();
  renderAdminSeriesTable();
  loadStoreSettings();
}


/* Stub kept for compatibility – no backend in static build */
function syncWithBackendDatabase(){ /* no-op: 100% static build */ }


/* ==========================================
   PUBLISH TO NETLIFY — نشر البيانات للموقع
   ==========================================
   يُنزّل data.json بكل البيانات الحالية.
   استبدل الملف في مجلد المشروع ثم ارفعه
   لـ Netlify ليراه جميع المستخدمين.
   ========================================== */
function publishToSite(){
  var DATA_KEYS = [
    'mstore_custom_series',
    'mstore_custom_products',
    'mstore_product_details',
    'mstore_product_overrides',
    'mstore_setting_facebook',
    'mstore_setting_tiktok',
    'mstore_setting_whatsapp_eg',
    'mstore_setting_whatsapp_uae',
    'mstore_setting_eyebrow',
    'mstore_setting_hero_title'
  ];

  var snapshot = {
    _version: Date.now(),
    _note: 'هذا الملف يحتوي على بيانات المتجر المنشورة. لتحديثه: افتح لوحة التحكم > إعدادات > نشر للموقع'
  };

  DATA_KEYS.forEach(function(key){
    var raw = localStorage.getItem(key);
    if(!raw) return;
    try{
      // محاولة تحليل JSON، وإلا حفظه كنص
      snapshot[key] = JSON.parse(raw);
    }catch(e){
      snapshot[key] = raw;
    }
  });

  var json = JSON.stringify(snapshot, null, 2);
  var blob = new Blob([json], {type: 'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'data.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  alert(
    '✅ تم تنزيل ملف data.json بنجاح!\n\n' +
    '📋 الخطوات التالية:\n' +
    '1️⃣ استبدل ملف data.json في مجلد المشروع بالملف الذي تم تنزيله\n' +
    '2️⃣ ارفع المشروع مجدداً على Netlify\n' +
    '3️⃣ جميع المستخدمين سيرون البيانات الجديدة فوراً! 🚀'
  );
}

function forceReloadFromDataJson(){
  if(!confirm('هل تريد إعادة تحميل بيانات الموقع المنشورة؟\nسيتم الاستبدال بآخر نسخة منشورة في data.json.')){
    return;
  }
  // مسح علامة التحميل لإجبار إعادة القراءة
  localStorage.removeItem('mstore_data_json_loaded_v1');
  location.reload();
}

/* ==========================================
   DIRECT GITHUB API PUBLISH — نشر مباشر إلى جيت هب
   ==========================================
   يقوم بتحديث ملف data.json في مستودع GitHub
   تلقائياً عبر GitHub REST API دون الحاجة لأي تعديل يدوي!
   ========================================== */
function publishDirectToGitHub(){
  var user = (document.getElementById('ghUsername') ? document.getElementById('ghUsername').value.trim() : '') || localStorage.getItem('mstore_setting_gh_user') || '';
  var repo = (document.getElementById('ghRepo') ? document.getElementById('ghRepo').value.trim() : '') || localStorage.getItem('mstore_setting_gh_repo') || '';
  var token = (document.getElementById('ghToken') ? document.getElementById('ghToken').value.trim() : '') || localStorage.getItem('mstore_setting_gh_token') || '';

  var statusEl = document.getElementById('ghPublishStatus');
  var btn = document.getElementById('btnPublishGitHub');

  function showStatus(msg, isSuccess, isError){
    if(!statusEl) return;
    statusEl.style.display = 'block';
    statusEl.style.background = isSuccess ? '#15331f' : (isError ? '#3a1616' : '#222');
    statusEl.style.border = isSuccess ? '1px solid #27ae60' : (isError ? '1px solid #e74c3c' : '1px solid #444');
    statusEl.style.color = isSuccess ? '#2ecc71' : (isError ? '#ff7675' : '#ccc');
    statusEl.innerHTML = msg;
  }

  if(!user || !repo || !token){
    alert('يرجى إدخال اسم المستخدم، اسم المستودع، ورمز الوصول الشخصي (Token) في الحقول أعلاه أولاً!');
    showStatus('⚠️ يرجى إكمال إعدادات GitHub أعلاه.', false, true);
    return;
  }

  // حفظ الإعدادات تلقائياً
  localStorage.setItem('mstore_setting_gh_user', user);
  localStorage.setItem('mstore_setting_gh_repo', repo);
  localStorage.setItem('mstore_setting_gh_token', token);

  if(btn){
    btn.disabled = true;
    btn.textContent = '⏳ جاري النشر إلى GitHub...';
  }
  showStatus('⏳ جاري التواصل مع GitHub وقراءة الملف الحالي...', false, false);

  // 1. تجهيز بيانات snapshot
  var DATA_KEYS = [
    'mstore_custom_series',
    'mstore_custom_products',
    'mstore_product_details',
    'mstore_product_overrides',
    'mstore_setting_facebook',
    'mstore_setting_tiktok',
    'mstore_setting_whatsapp_eg',
    'mstore_setting_whatsapp_uae',
    'mstore_setting_eyebrow',
    'mstore_setting_hero_title'
  ];

  var snapshot = {
    _version: Date.now(),
    _updated_at: new Date().toISOString(),
    _note: 'تم التحديث تلقائياً من لوحة تحكم MSTORE عبر GitHub API'
  };

  DATA_KEYS.forEach(function(key){
    var raw = localStorage.getItem(key);
    if(!raw) return;
    try{
      snapshot[key] = JSON.parse(raw);
    }catch(e){
      snapshot[key] = raw;
    }
  });

  var jsonContent = JSON.stringify(snapshot, null, 2);
  
  // تشفير المحتوى إلى Base64 مع دعم كامل للنصوص العربية (UTF-8)
  var encodedContent = btoa(unescape(encodeURIComponent(jsonContent)));

  var apiUrl = 'https://api.github.com/repos/' + encodeURIComponent(user) + '/' + encodeURIComponent(repo) + '/contents/data.json';

  // 2. الحصول على SHA الحالي لملف data.json (إن وجد)
  fetch(apiUrl, {
    headers: {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github.v3+json'
    }
  })
  .then(function(res){
    if(res.status === 200){
      return res.json().then(function(d){ return d.sha; });
    } else if(res.status === 404){
      return null; // الملف غير موجود بعد، سيتم إنشاؤه
    } else {
      throw new Error('فشل الوصول للمستودع (كود الخطأ: ' + res.status + '). تأكد من صحة اسم المستخدم، المستودع، وصلاحية الـ Token.');
    }
  })
  .then(function(currentSha){
    // 3. كتابة وتحديث الملف في GitHub عبر PUT
    showStatus('📤 جاري حفظ التحديثات في GitHub وتفعيل النشر...', false, false);
    
    var bodyData = {
      message: 'تحديث بيانات المتجر من لوحة التحكم - ' + new Date().toLocaleDateString('ar-EG'),
      content: encodedContent
    };
    if(currentSha){
      bodyData.sha = currentSha;
    }

    return fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': 'token ' + token,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(bodyData)
    });
  })
  .then(function(putRes){
    if(putRes.ok){
      return putRes.json();
    } else {
      return putRes.json().then(function(err){
        throw new Error(err.message || 'فشل في حفظ التعديلات داخل GitHub.');
      });
    }
  })
  .then(function(){
    if(btn){
      btn.disabled = false;
      btn.textContent = '✓ تم النشر بنجاح!';
      setTimeout(function(){
        btn.textContent = '🚀 نشر التحديثات إلى GitHub و Netlify تلقائياً';
      }, 4000);
    }
    showStatus('🎉 <b>تم النشر بنجاح إلى GitHub!</b> يقوم Netlify الآن بتحديث الموقع تلقائياً لجميع الزوار خلال ثوانٍ معدودة.', true, false);
    alert('🎉 رائع! تم إرسال كل التعديلات إلى GitHub مباشرة!\n\nNetlify سيقوم بتحديث الموقع لكل الزبائن والزوار تلقائياً دون أي تدخل منك.');
  })
  .catch(function(err){
    console.error('GitHub API error:', err);
    if(btn){
      btn.disabled = false;
      btn.textContent = '❌ فشل النشر - حاول ثانية';
      setTimeout(function(){
        btn.textContent = '🚀 نشر التحديثات إلى GitHub و Netlify تلقائياً';
      }, 3000);
    }
    showStatus('❌ خطأ: ' + err.message, false, true);
    alert('تعذر النشر التلقائي:\n' + err.message + '\n\nملاحظة: يمكنك استخدام زر "تنزيل data.json" كحل بديل في أي وقت.');
  });
}


