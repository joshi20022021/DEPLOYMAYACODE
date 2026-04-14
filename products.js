// MayaCode S.A. - Catálogo de Productos
// MayaCode S.A. - Catálogo de Productos (Con Imágenes Reales)
// MayaCode S.A. - Catálogo de Productos Completo (30 Items)
const PRODUCTS = [
  // ─── LAPTOPS ──────────────────────────────────────────────────────────────
  {
    id: 1,
    name: "Dell Inspiron 15 3000",
    category: "laptops",
    price: 3500,
    oldPrice: 3900,
    stock: 12,
    badge: "Popular",
    rating: 4.3,
    reviews: 87,
    description: "Laptop confiable para trabajo y estudio diario.",
    fullDescription: "La Dell Inspiron 15 3000 es la elección perfecta para profesionales y estudiantes...",
    specs: ["Intel Core i5-1135G7", "8GB RAM", "SSD 256GB", "Windows 11"],
    image: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: 2,
    name: "HP Pavilion 14 Core i7",
    category: "laptops",
    price: 4800,
    oldPrice: 5200,
    stock: 8,
    badge: "Nuevo",
    rating: 4.5,
    reviews: 62,
    description: "Laptop ultradelgada con procesador i7.",
    fullDescription: "La HP Pavilion 14 combina elegancia y potencia...",
    specs: ["Intel Core i7-1255U", "16GB RAM", "SSD 512GB", "Pantalla 14\" IPS"],
    image: "https://picsum.photos/seed/hp-pavilion-14/800/600"
  },
  {
    id: 3,
    name: "Lenovo ThinkPad E14 Gen 4",
    category: "laptops",
    price: 5200,
    oldPrice: null,
    stock: 6,
    badge: "Empresarial",
    rating: 4.7,
    reviews: 134,
    description: "El estándar empresarial con seguridad MIL-SPEC.",
    fullDescription: "El ThinkPad E14 Gen 4 es sinónimo de confiabilidad...",
    specs: ["AMD Ryzen 5 5625U", "16GB RAM", "SSD 512GB", "Windows 11 Pro"],
    image: "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: 4,
    name: "Asus VivoBook 15 OLED",
    category: "laptops",
    price: 4100,
    oldPrice: 4600,
    stock: 10,
    badge: "Oferta",
    rating: 4.4,
    reviews: 95,
    description: "Pantalla OLED de 15.6\" con colores vibrantes.",
    fullDescription: "La Asus VivoBook 15 OLED destaca por su impresionante pantalla...",
    specs: ["Intel Core i5-1235U", "8GB RAM", "SSD 512GB", "OLED FHD"],
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: 5,
    name: "Acer Aspire 5 Slim",
    category: "laptops",
    price: 2900,
    oldPrice: 3300,
    stock: 15,
    badge: "Mejor precio",
    rating: 4.1,
    reviews: 211,
    description: "La opción más accesible sin sacrificar rendimiento.",
    fullDescription: "El Acer Aspire 5 Slim es ideal para el trabajo remoto...",
    specs: ["AMD Ryzen 3 5300U", "8GB RAM", "SSD 256GB"],
    image: "https://images.unsplash.com/photo-1592434134753-a70baf7979d5?q=80&w=800&auto=format&fit=crop"
  },
  // ─── MONITORES ─────────────────────────────────────────────────────────────
  {
    id: 6,
    name: "Samsung Monitor 24\" IPS",
    category: "monitores",
    price: 1250,
    oldPrice: 1450,
    stock: 20,
    badge: "Popular",
    rating: 4.5,
    reviews: 178,
    image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: 7,
    name: "LG UltraWide 29\" QHD",
    category: "monitores",
    price: 2850,
    oldPrice: null,
    stock: 7,
    badge: "Premium",
    rating: 4.8,
    reviews: 89,
    image: "https://images.unsplash.com/photo-1551645120-d70bfe84c826?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: 8,
    name: "Dell S2421HN 24\" FHD",
    category: "monitores",
    price: 1100,
    oldPrice: 1300,
    stock: 14,
    badge: "Oferta",
    rating: 4.3,
    reviews: 145,
    image: "https://images.unsplash.com/photo-1586210579191-33b45e38fa2c?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: 9,
    name: "AOC 27\" Curved Gaming",
    category: "monitores",
    price: 1650,
    oldPrice: 1900,
    stock: 9,
    badge: "Gaming",
    rating: 4.4,
    reviews: 67,
    image: "https://images.unsplash.com/photo-1616763355548-1b606f439f86?q=80&w=800&auto=format&fit=crop"
  },
  // ─── TECLADOS ──────────────────────────────────────────────────────────────
  {
    id: 10,
    name: "Logitech MX Keys Advanced",
    category: "teclados",
    price: 680,
    oldPrice: 780,
    stock: 25,
    badge: "Top ventas",
    rating: 4.8,
    reviews: 302,
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: 11,
    name: "Redragon K552 Kumara",
    category: "teclados",
    price: 290,
    oldPrice: 350,
    stock: 30,
    badge: "Gaming",
    rating: 4.2,
    reviews: 456,
    image: "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: 12,
    name: "HyperX Alloy Core RGB",
    category: "teclados",
    price: 430,
    oldPrice: null,
    stock: 18,
    badge: "Silencioso",
    rating: 4.3,
    reviews: 189,
    image: "https://picsum.photos/seed/hyperx-alloy-core/800/600"
  },
  // ─── MOUSE ─────────────────────────────────────────────────────────────────
  {
    id: 13,
    name: "Logitech MX Master 3S",
    category: "mouse",
    price: 820,
    oldPrice: 950,
    stock: 22,
    badge: "Premium",
    rating: 4.9,
    reviews: 521,
    image: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: 14,
    name: "Razer DeathAdder V3",
    category: "mouse",
    price: 580,
    oldPrice: 680,
    stock: 16,
    badge: "Gaming",
    rating: 4.7,
    reviews: 234,
    image: "https://images.unsplash.com/photo-1527814050087-3793815479db?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: 15,
    name: "Microsoft Arc Mouse",
    category: "mouse",
    price: 390,
    oldPrice: null,
    stock: 11,
    badge: "Ultra-portátil",
    rating: 4.2,
    reviews: 98,
    image: "https://picsum.photos/seed/microsoft-arc-mouse/800/600"
  },
  // ─── AURICULARES ───────────────────────────────────────────────────────────
  {
    id: 16,
    name: "Sony WH-1000XM5",
    category: "auriculares",
    price: 2100,
    oldPrice: 2500,
    stock: 8,
    badge: "Mejor ANC",
    rating: 4.9,
    reviews: 687,
    image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: 17,
    name: "JBL Tune 770NC",
    category: "auriculares",
    price: 720,
    oldPrice: 850,
    stock: 19,
    badge: "Relación-precio",
    rating: 4.4,
    reviews: 312,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: 18,
    name: "Jabra Evolve2 55 UC",
    category: "auriculares",
    price: 2400,
    oldPrice: null,
    stock: 5,
    badge: "Empresarial",
    rating: 4.7,
    reviews: 156,
    image: "https://images.unsplash.com/photo-1484704849700-f032a568e944?q=80&w=800&auto=format&fit=crop"
  },
  // ─── WEBCAMS ───────────────────────────────────────────────────────────────
  {
    id: 19,
    name: "Logitech C920 HD Pro",
    category: "webcams",
    price: 640,
    oldPrice: 750,
    stock: 23,
    badge: "Más vendida",
    rating: 4.6,
    reviews: 892,
    image: "https://picsum.photos/seed/logitech-c920/800/600"
  },
  {
    id: 20,
    name: "Razer Kiyo Pro Ultra",
    category: "webcams",
    price: 1850,
    oldPrice: 2100,
    stock: 4,
    badge: "4K",
    rating: 4.5,
    reviews: 143,
    image: "https://picsum.photos/seed/razer-kiyo-pro/800/600"
  },
  // ─── HUBS Y CABLES ─────────────────────────────────────────────────────────
  {
    id: 21,
    name: "Anker 7-en-1 Hub USB-C",
    category: "hubs-cables",
    price: 360,
    oldPrice: 420,
    stock: 35,
    badge: "Más vendido",
    rating: 4.7,
    reviews: 567,
    image: "https://images.unsplash.com/photo-1563991655280-cb95c90ca2fb?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: 22,
    name: "Cable HDMI 2.1 Ultra HD 2m",
    category: "hubs-cables",
    price: 95,
    oldPrice: null,
    stock: 50,
    badge: "8K",
    rating: 4.5,
    reviews: 234,
    image: "https://picsum.photos/seed/hdmi-cable-21/800/600"
  },
  {
    id: 23,
    name: "Hub USB-C 12-en-1 Pro",
    category: "hubs-cables",
    price: 580,
    oldPrice: 680,
    stock: 12,
    badge: "Completo",
    rating: 4.6,
    reviews: 189,
    image: "https://picsum.photos/seed/usb-c-hub-12in1/800/600"
  },
  // ─── SSD EXTERNOS ──────────────────────────────────────────────────────────
  {
    id: 24,
    name: "Samsung T7 Portable SSD 1TB",
    category: "ssd-externos",
    price: 850,
    oldPrice: 980,
    stock: 17,
    badge: "Ultra-rápido",
    rating: 4.8,
    reviews: 423,
    image: "https://picsum.photos/seed/samsung-t7-ssd/800/600"
  },
  {
    id: 25,
    name: "WD My Passport Ultra 2TB",
    category: "ssd-externos",
    price: 680,
    oldPrice: null,
    stock: 21,
    badge: "Gran capacidad",
    rating: 4.4,
    reviews: 356,
    image: "https://picsum.photos/seed/wd-passport-2tb/800/600"
  },
  // ─── MEMORIAS RAM ──────────────────────────────────────────────────────────
  {
    id: 26,
    name: "Kingston 16GB DDR4 3200MHz",
    category: "memorias-ram",
    price: 380,
    oldPrice: 450,
    stock: 28,
    badge: "Más vendida",
    rating: 4.6,
    reviews: 641,
    image: "https://images.unsplash.com/photo-1562976540-1502c2145186?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: 27,
    name: "Corsair Vengeance 32GB DDR5",
    category: "memorias-ram",
    price: 890,
    oldPrice: 1050,
    stock: 10,
    badge: "DDR5",
    rating: 4.7,
    reviews: 198,
    image: "https://images.unsplash.com/photo-1541029071515-84cc54f84dc5?q=80&w=800&auto=format&fit=crop"
  },
  // ─── IMPRESORAS ────────────────────────────────────────────────────────────
  {
    id: 28,
    name: "HP LaserJet Pro M404dn",
    category: "impresoras",
    price: 1950,
    oldPrice: 2200,
    stock: 7,
    badge: "Empresarial",
    rating: 4.5,
    reviews: 167,
    image: "https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: 29,
    name: "Epson EcoTank ET-4850",
    category: "impresoras",
    price: 2100,
    oldPrice: null,
    stock: 9,
    badge: "Sin cartuchos",
    rating: 4.6,
    reviews: 289,
    image: "https://picsum.photos/seed/epson-ecotank-4850/800/600"
  },
  // ─── TABLETS ───────────────────────────────────────────────────────────────
  {
    id: 30,
    name: "Samsung Galaxy Tab A9+ 5G",
    category: "tablets",
    price: 2200,
    oldPrice: 2600,
    stock: 13,
    badge: "5G",
    rating: 4.4,
    reviews: 321,
    image: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?q=80&w=800&auto=format&fit=crop"
  }
];
// Categorías disponibles
const CATEGORIES = [
  { id: "all",          label: "Todos",           icon: "🛒" },
  { id: "laptops",      label: "Laptops",          icon: "💻" },
  { id: "monitores",    label: "Monitores",        icon: "🖥️" },
  { id: "teclados",     label: "Teclados",         icon: "⌨️" },
  { id: "mouse",        label: "Mouse",            icon: "🖱️" },
  { id: "auriculares",  label: "Auriculares",      icon: "🎧" },
  { id: "webcams",      label: "Webcams",          icon: "📷" },
  { id: "hubs-cables",  label: "Hubs & Cables",    icon: "🔌" },
  { id: "ssd-externos", label: "SSD Externos",     icon: "💾" },
  { id: "memorias-ram", label: "Memorias RAM",     icon: "🧠" },
  { id: "impresoras",   label: "Impresoras",       icon: "🖨️" },
  { id: "tablets",      label: "Tablets",          icon: "📱" }
];

// Departamentos de Guatemala
const DEPARTAMENTOS_GT = [
  "Guatemala","Sacatepéquez","Chimaltenango","Escuintla","Santa Rosa","Sololá",
  "Totonicapán","Quetzaltenango","Suchitepéquez","Retalhuleu","San Marcos",
  "Huehuetenango","Quiché","Baja Verapaz","Alta Verapaz","Petén",
  "Izabal","Zacapa","Chiquimula","Jalapa","Jutiapa","El Progreso"
];
