/**
 * Glow Care - Central Data Store & LocalStorage Manager
 * Handles Products, Services, Appointments, User Auth, Scan History, Cart & Favorites
 */

const STORAGE_KEYS = {
  PRODUCTS: 'glowcare_products',
  SERVICES: 'glowcare_services',
  APPOINTMENTS: 'glowcare_appointments',
  CURRENT_USER: 'glowcare_current_user',
  USERS: 'glowcare_users',
  LAST_SCAN: 'glowcare_last_scan',
  SCAN_HISTORY: 'glowcare_scan_history',
  CART: 'glowcare_cart',
  FAVORITES: 'glowcare_favorites',
  THEME: 'glowcare_theme',
  MESSAGES: 'glowcare_contact_messages'
};

// Initial Seed Products
const DEFAULT_PRODUCTS = [
  {
    id: 'prod-1',
    name: 'Clarifying Salicylic Acid Gentle Gel Cleanser',
    category: 'Cleansers',
    price: 24.00,
    rating: 4.8,
    reviewsCount: 142,
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=700&q=80',
    concerns: ['Pimples / Acne', 'Visible Pores', 'Oily Skin', 'Blackheads'],
    skinType: ['Oily', 'Combination', 'Acne-Prone'],
    shortDesc: 'A pH-balanced 2% Salicylic Acid cleanser that penetrates deep into pores to dissolve excess sebum and reduce breakouts.',
    recommendationReason: 'Contains 2% BHA to gently decongest clogged pores, control T-zone shine, and calm active pimples without stripping natural moisture.',
    badge: 'Best for Acne & Pores',
    ingredients: 'Water, Cocamidopropyl Betaine, Salicylic Acid (2%), Niacinamide, Melaleuca Alternifolia (Tea Tree) Leaf Extract, Allantoin, Glycerin.',
    usage: 'Lather a pea-sized amount onto damp face morning and night. Massage for 60 seconds before rinsing.'
  },
  {
    id: 'prod-2',
    name: 'Ultra-Hydrating Ceramide Milk Cleanser',
    category: 'Cleansers',
    price: 26.00,
    rating: 4.9,
    reviewsCount: 189,
    image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=700&q=80',
    concerns: ['Dryness', 'Redness', 'Uneven skin tone'],
    skinType: ['Dry', 'Sensitive', 'Normal'],
    shortDesc: 'Nourishing milky emulsion enriched with 3 essential ceramides and hyaluronic acid to soothe tight, flaky skin.',
    recommendationReason: 'Formulated with bio-identical ceramides to instantly reinforce a compromised skin barrier and ease dryness-induced redness.',
    badge: 'Gentle on Sensitive Skin',
    ingredients: 'Aqua, Glycerin, Caprylic/Capric Triglyceride, Ceramide NP, Ceramide AP, Ceramide EOP, Phytosphingosine, Cholesterol, Hyaluronic Acid.',
    usage: 'Apply gently to dry or damp skin, massage in circular motions, and tissue off or rinse with lukewarm water.'
  },
  {
    id: 'prod-3',
    name: 'Oil-Free Mattifying Water Gel Moisturizer',
    category: 'Moisturizers',
    price: 28.50,
    rating: 4.7,
    reviewsCount: 215,
    image: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=700&q=80',
    concerns: ['Oily Skin', 'Pimples / Acne', 'Visible Pores'],
    skinType: ['Oily', 'Combination'],
    shortDesc: 'Ultra-lightweight cooling hydro-gel that locks in weightless moisture with zero shine and a matte velvety finish.',
    recommendationReason: 'Non-comedogenic oil-free formulation that delivers all-day hydration without suffocating pores or triggering oil spikes.',
    badge: 'Zero-Shine Hydration',
    ingredients: 'Aqua, Butylene Glycol, Dimethicone Crosspolymer, Niacinamide, Sodium Hyaluronate, Green Tea Leaf Extract, Silica.',
    usage: 'Smooth evenly over cleansed face and neck every morning and night.'
  },
  {
    id: 'prod-4',
    name: 'Deep Barrier Ceramide Night Recovery Cream',
    category: 'Moisturizers',
    price: 36.00,
    rating: 4.9,
    reviewsCount: 97,
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=700&q=80',
    concerns: ['Dryness', 'Redness', 'Skin Repair'],
    skinType: ['Dry', 'Very Dry', 'Sensitive'],
    shortDesc: 'Rich barrier repair cream packed with squalane, fatty acids, and centella asiatica to repair micro-tears overnight.',
    recommendationReason: 'Specifically targets severe moisture loss and flaky patches, restoring skin suppleness and elasticity while you sleep.',
    badge: 'Intense Repair',
    ingredients: 'Water, Butyrospermum Parkii (Shea) Butter, Squalane, Ceramide NP, Centella Asiatica Extract, Panthenol (Pro-Vitamin B5).',
    usage: 'Warm a dime-sized amount between fingers and press firmly onto face before bed.'
  },
  {
    id: 'prod-5',
    name: 'Invisible Glow Shield Mineral Sunscreen SPF 50+',
    category: 'Sunscreens',
    price: 32.00,
    rating: 4.9,
    reviewsCount: 310,
    image: 'https://images.unsplash.com/photo-1567928815104-b7980ee5032e?auto=format&fit=crop&w=700&q=80',
    concerns: ['Dark spots', 'Pigmentation', 'Uneven skin tone', 'Redness'],
    skinType: ['All Skin Types', 'Sensitive'],
    shortDesc: '100% non-nano zinc oxide sunscreen offering broad-spectrum UVA/UVB protection with zero white cast and skin-loving antioxidants.',
    recommendationReason: 'Prevents UV-induced hyperpigmentation, protects delicate post-acne blemishes from darkening, and calms surface redness.',
    badge: 'Dermatologist Favorite',
    ingredients: 'Zinc Oxide 12%, Water, C12-15 Alkyl Benzoate, Niacinamide, Tocopherol (Vitamin E), Bisabolol, Ferulic Acid.',
    usage: 'Apply liberally 15 minutes before sun exposure. Reapply every 2 hours or after 80 minutes of swimming/sweating.'
  },
  {
    id: 'prod-6',
    name: 'Matte Oil-Control Fluid Sunscreen SPF 45',
    category: 'Sunscreens',
    price: 29.00,
    rating: 4.6,
    reviewsCount: 88,
    image: 'https://images.unsplash.com/photo-1556228852-80b6e5eeff06?auto=format&fit=crop&w=700&q=80',
    concerns: ['Oily Skin', 'Visible Pores', 'Pimples / Acne'],
    skinType: ['Oily', 'Combination'],
    shortDesc: 'Breathable fluid SPF featuring oil-absorbing silica micro-sponges that blur pores and keep skin shine-free for 12 hours.',
    recommendationReason: 'Ideal for oily and acne-prone skin prone to greasy sunscreen residue; controls sebum production while shielding from UV rays.',
    badge: 'Pore-Blurring SPF',
    ingredients: 'Homosalate 10%, Octisalate 5%, Avobenzone 3%, Silica, Zinc PCA, Hamamelis Virginiana (Witch Hazel) Extract.',
    usage: 'Shake bottle well. Smooth two finger-lengths across face as final step of morning routine.'
  },
  {
    id: 'prod-7',
    name: '10% Niacinamide + Zinc 1% Pore Refining Serum',
    category: 'Serums',
    price: 22.00,
    rating: 4.8,
    reviewsCount: 420,
    image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=700&q=80',
    concerns: ['Visible Pores', 'Oily Skin', 'Redness', 'Uneven skin tone'],
    skinType: ['Oily', 'Combination', 'Normal'],
    shortDesc: 'High-potency clinical vitamin & mineral formula that visibly tightens dilated pores and balances surface sebum production.',
    recommendationReason: 'Clinically proven to minimize pore diameter, normalize sebum activity, and smooth rough skin texture in just 14 days.',
    badge: 'Award Winner',
    ingredients: 'Aqua, Niacinamide (10%), Zinc PCA (1%), Pentylene Glycol, Tamarindus Indica Seed Gum, Phenoxyethanol.',
    usage: 'Apply 3-4 drops morning and evening before heavier creams. Avoid mixing with direct pure Vitamin C.'
  },
  {
    id: 'prod-8',
    name: '15% Vitamin C + Alpha Arbutin Brightening Elixir',
    category: 'Brightening',
    price: 42.00,
    rating: 4.9,
    reviewsCount: 260,
    image: 'https://images.unsplash.com/photo-1608248597359-0a955743b194?auto=format&fit=crop&w=700&q=80',
    concerns: ['Dark spots', 'Pigmentation', 'Uneven skin tone'],
    skinType: ['All Skin Types'],
    shortDesc: 'Potent stable L-Ascorbic Acid and Alpha Arbutin serum targeting stubborn melanin clusters and fading dark spots.',
    recommendationReason: 'Directly suppresses tyrosinase enzyme activity to fade hyperpigmentation, brighten dull areas, and even out patchy skin tone.',
    badge: 'Spot Brightener',
    ingredients: 'Ethoxydiglycol, Ascorbic Acid (15%), Alpha Arbutin (2%), Ferulic Acid, Hyaluronic Acid, Citrus Aurantium Dulcis Extract.',
    usage: 'Pat 3 drops onto clean dry skin every morning. Always follow with broad spectrum SPF 50 sunscreen.'
  },
  {
    id: 'prod-9',
    name: '2% BHA Liquid Exfoliant & Blackhead Clarifier',
    category: 'Acne Care',
    price: 34.00,
    rating: 4.9,
    reviewsCount: 512,
    image: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=700&q=80',
    concerns: ['Blackheads', 'Visible Pores', 'Pimples / Acne'],
    skinType: ['Oily', 'Combination'],
    shortDesc: 'Leave-on liquid salicylic acid exfoliator that sheds dead skin cells and sweeps away stubborn blackheads inside pores.',
    recommendationReason: 'Oil-soluble BHA travels deep inside follicles to dissolve stubborn keratin plugs and prevent blackhead re-formation.',
    badge: 'Cult Favorite',
    ingredients: 'Water, Methylpropanediol, Butylene Glycol, Salicylic Acid (2%), Camellia Sinensis (Green Tea) Leaf Extract, Sodium Hydroxide.',
    usage: 'Apply with a cotton pad or hands over entire face after cleansing. Do not rinse off. Begin using 2-3 nights per week.'
  },
  {
    id: 'prod-10',
    name: '2% Pure Hyaluronic Acid + B5 Moisture Booster',
    category: 'Hydration',
    price: 25.00,
    rating: 4.8,
    reviewsCount: 340,
    image: 'https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&w=700&q=80',
    concerns: ['Dryness', 'Uneven skin tone', 'Skin Repair'],
    skinType: ['Dry', 'Dehydrated', 'All Skin Types'],
    shortDesc: 'Multi-molecular weight hyaluronic acid serum that floods parched skin cells with deep, plumping, multi-depth hydration.',
    recommendationReason: 'Combines low, medium and high molecular weights to replenish surface moisture and penetrate deeper layers to relieve dehydration.',
    badge: 'Instant Hydration',
    ingredients: 'Aqua, Sodium Hyaluronate, Panthenol (Vitamin B5), Ahnfeltia Concinna Extract, Glycerin, Trisodium Ethylenediamine Disuccinate.',
    usage: 'Apply to slightly damp skin immediately after cleansing to bind moisture into cells.'
  },
  {
    id: 'prod-11',
    name: 'Caffeine 5% + Multi-Peptide Under-Eye Awakening Gel',
    category: 'Serums',
    price: 27.00,
    rating: 4.7,
    reviewsCount: 165,
    image: 'https://images.unsplash.com/photo-1512290900672-1f55b93475d4?auto=format&fit=crop&w=700&q=80',
    concerns: ['Under-eye darkness', 'Uneven skin tone'],
    skinType: ['All Skin Types'],
    shortDesc: 'Targeted cooling eye concentrate with high-solubility green tea caffeine and matrixyl peptides to depuff and brighten dark circles.',
    recommendationReason: 'Stimulates micro-circulation in the fragile under-eye vascular bed to reduce shadows, fatigue signs, and pigment accumulation.',
    badge: 'Depuff & Brighten',
    ingredients: 'Aqua, Caffeine (5%), Epigallocatechin Gallatyl Glucoside (EGCG), Palmitoyl Tripeptide-38, Hyaluronic Acid, Hydroxyethylcellulose.',
    usage: 'Gently tap a tiny pin-sized drop around the orbital eye contour morning and evening using your ring finger.'
  },
  {
    id: 'prod-12',
    name: 'Centella Cica Soothing Barrier Rescue Balm',
    category: 'Skin Repair',
    price: 31.00,
    rating: 4.9,
    reviewsCount: 178,
    image: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=700&q=80',
    concerns: ['Redness', 'Dryness', 'Pimples / Acne', 'Skin Repair'],
    skinType: ['Sensitive', 'Compromised', 'Dry'],
    shortDesc: 'Intensive restorative soothing balm featuring 70% pure Madagascan Centella Asiatica and madecassoside for stressed skin.',
    recommendationReason: 'Immediately cools flare-ups, diminishes angry capillary redness, and accelerates healing of irritated skin barriers.',
    badge: 'Calms Redness Fast',
    ingredients: 'Centella Asiatica Extract, Madecassoside, Asiaticoside, Panthenol, Ceramide NP, Squalane, Portulaca Oleracea Extract.',
    usage: 'Apply generously to irritated zones or all over face when experiencing redness, tightness, or stinging.'
  }
];

// Initial Seed Services
const DEFAULT_SERVICES = [
  {
    id: 'srv-1',
    name: 'Hydra-Glow Deep Pore Facial',
    category: 'Facial',
    duration: '60 mins',
    price: 85.00,
    rating: 4.9,
    reviewsCount: 210,
    image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=700&q=80',
    description: 'Medical-grade vortex vacuum suction to extract blackheads and sebum plugs, followed by intensive antioxidant and hyaluronic acid infusion.',
    benefits: ['Deep pore purification', 'Immediate glass-skin radiance', 'Painless blackhead extraction', 'Zero downtime'],
    suitedFor: 'Enlarged pores, dullness, congested skin, uneven texture'
  },
  {
    id: 'srv-2',
    name: 'Advanced Acne Care Therapy',
    category: 'Acne Care',
    duration: '75 mins',
    price: 95.00,
    rating: 4.9,
    reviewsCount: 174,
    image: 'https://images.unsplash.com/photo-1512290903029-450f6ee47738?auto=format&fit=crop&w=700&q=80',
    description: 'Specialized clinical acne treatment including high-frequency antibacterial sterilization, medical salicylic peel, and soothing 415nm Blue LED therapy.',
    benefits: ['Kills acne-causing P. acnes bacteria', 'Reduces cystic inflammation', 'Prevents post-acne scarring', 'Calms active redness'],
    suitedFor: 'Pimples, cystic breakouts, active acne, persistent blackheads'
  },
  {
    id: 'srv-3',
    name: 'Deep Barrier Skin Care & Cryo Infusion',
    category: 'Skin Care',
    duration: '60 mins',
    price: 90.00,
    rating: 4.8,
    reviewsCount: 130,
    image: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=700&q=80',
    description: 'Cryo-cooling wand technology that calms surface capillary redness while driving ceramides, peptides, and plant collagen into sensitized skin layers.',
    benefits: ['Restores damaged stratum corneum', 'Instant relief from stinging & burning', 'Plumps fine dehydration lines', 'Improves skin resilience'],
    suitedFor: 'Sensitized skin, severe dryness, rosacea-prone redness, flaky patches'
  },
  {
    id: 'srv-4',
    name: 'Botanical Scalp & Hair Detox',
    category: 'Hair Care',
    duration: '50 mins',
    price: 70.00,
    rating: 4.8,
    reviewsCount: 88,
    image: 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?auto=format&fit=crop&w=700&q=80',
    description: 'Holistic trichology-inspired scalp treatment featuring tea-tree exfoliating scrubs, warm peptide ozone steam, and deep follicle revitalization.',
    benefits: ['Removes product build-up & flakes', 'Stimulates sluggish follicles', 'Imparts natural glossy shine', 'Relieves itchy tension'],
    suitedFor: 'Dry or oily scalp, dull lifeless hair, product build-up'
  },
  {
    id: 'srv-5',
    name: 'Royal Bridal Glow Makeup & Consultation',
    category: 'Bridal Makeup',
    duration: '120 mins',
    price: 180.00,
    rating: 5.0,
    reviewsCount: 312,
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=700&q=80',
    description: 'Long-wearing waterproof luxury HD airbrush makeup tailored to your wedding lighting, featuring custom mink lashes and luminous contouring.',
    benefits: ['18-hour sweatproof durability', 'Camera-ready flawless HD finish', 'Custom skin prep treatment included', 'Full jewelry & veil setting'],
    suitedFor: 'Brides, engagement ceremonies, gala occasions'
  },
  {
    id: 'srv-6',
    name: 'Couture Hair Styling & Updos',
    category: 'Hair Styling',
    duration: '60 mins',
    price: 75.00,
    rating: 4.7,
    reviewsCount: 95,
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=700&q=80',
    description: 'Artisanal styling ranging from textured Hollywood waves and voluminous blowouts to intricate braided red-carpet updos.',
    benefits: ['Heat defense protection', 'Long-lasting structural hold without stiffness', 'Personalized face-framing style', 'Includes luxury accessories'],
    suitedFor: 'Parties, photoshoots, cocktail events, receptions'
  },
  {
    id: 'srv-7',
    name: 'Luxury Organic Gel Manicure',
    category: 'Manicure',
    duration: '45 mins',
    price: 45.00,
    rating: 4.9,
    reviewsCount: 140,
    image: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=700&q=80',
    description: 'Precision cuticle grooming, organic argan oil scrub, warm paraffin wax immersion, and chip-proof high-gloss LED gel polish.',
    benefits: ['3-week chip-free wear', 'Intense moisture restoration for cuticles', 'Safe non-toxic 10-free gel formulas', 'Hand & wrist acupressure'],
    suitedFor: 'Nail grooming, bridal preparation, everyday self-care'
  },
  {
    id: 'srv-8',
    name: 'Herbal Dead Sea Pedicure Treatment',
    category: 'Pedicure',
    duration: '50 mins',
    price: 55.00,
    rating: 4.8,
    reviewsCount: 119,
    image: 'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?auto=format&fit=crop&w=700&q=80',
    description: 'Invigorating eucalyptus and dead sea salt foot bath, gentle callus smoothing, peppermint clay mask, and heated towel wrap.',
    benefits: ['Relieves tired swollen feet', 'Softens cracked heel calluses', 'Stimulates lower body circulation', 'Long-lasting polished finish'],
    suitedFor: 'Rough feet, callus buildup, stress relief'
  },
  {
    id: 'srv-9',
    name: 'Deep Aromatherapy Relaxation Spa',
    category: 'Spa',
    duration: '90 mins',
    price: 120.00,
    rating: 5.0,
    reviewsCount: 245,
    image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=700&q=80',
    description: 'Full-body restorative massage utilizing organic French lavender and bergamot essential oils combined with heated basalt river stones.',
    benefits: ['Melts deep muscle knots & tension', 'Reduces cortisol and anxiety', 'Improves lymphatic drainage', 'Restores mental clarity'],
    suitedFor: 'Stress relief, chronic fatigue, body rejuvenation'
  },
  {
    id: 'srv-10',
    name: 'Red Carpet Evening Glam Makeup',
    category: 'Makeup',
    duration: '60 mins',
    price: 85.00,
    rating: 4.9,
    reviewsCount: 160,
    image: 'https://images.unsplash.com/photo-1503236823255-94609f598e71?auto=format&fit=crop&w=700&q=80',
    description: 'Show-stopping evening makeup tailored with dramatic cut-crease eyeshadow or signature winged eyeliner, sculpted cheekbones, and velvet lips.',
    benefits: ['Photo-flashback safe formulation', 'Includes premium faux mink lashes', 'Personalized color matching', 'Complimentary touch-up kit'],
    suitedFor: 'Evening galas, milestone birthdays, prom, prom nights'
  }
];

// Initial Seed Users
const DEFAULT_USERS = [
  {
    id: 'usr-1',
    name: 'Sarah Jenkins',
    email: 'demo@glowcare.com',
    password: 'password123',
    role: 'user',
    phone: '+1 (555) 234-5678',
    skinType: 'Combination',
    primaryConcern: 'Pimples & Pores',
    joinedDate: '2026-01-15'
  },
  {
    id: 'usr-admin',
    name: 'Dr. Elena Vance (Admin)',
    email: 'admin@glowcare.com',
    password: 'admin123',
    role: 'admin',
    phone: '+1 (555) 888-9999',
    skinType: 'Normal',
    primaryConcern: 'Anti-Aging',
    joinedDate: '2025-10-01'
  }
];

// Initial Seed Appointments
const DEFAULT_APPOINTMENTS = [
  {
    id: 'GC-2026-1042',
    serviceId: 'srv-1',
    serviceName: 'Hydra-Glow Deep Pore Facial',
    date: '2026-09-28',
    time: '11:30 AM',
    customerName: 'Sarah Jenkins',
    customerEmail: 'demo@glowcare.com',
    customerPhone: '+1 (555) 234-5678',
    notes: 'Please focus on T-zone blackheads and extraction.',
    price: 85.00,
    status: 'Confirmed',
    createdAt: '2026-09-24T14:30:00Z'
  },
  {
    id: 'GC-2026-1043',
    serviceId: 'srv-2',
    serviceName: 'Advanced Acne Care Therapy',
    date: '2026-09-30',
    time: '02:00 PM',
    customerName: 'Marcus Sterling',
    customerEmail: 'marcus@example.com',
    customerPhone: '+1 (555) 432-8765',
    notes: 'Frequent breakouts along cheek area.',
    price: 95.00,
    status: 'Pending',
    createdAt: '2026-09-25T09:15:00Z'
  },
  {
    id: 'GC-2026-1040',
    serviceId: 'srv-5',
    serviceName: 'Royal Bridal Glow Makeup & Consultation',
    date: '2026-09-25',
    time: '10:00 AM',
    customerName: 'Emily Watson',
    customerEmail: 'emily@example.com',
    customerPhone: '+1 (555) 998-1122',
    notes: 'Trial for wedding in December. Dewy makeup preference.',
    price: 180.00,
    status: 'Confirmed',
    createdAt: '2026-09-20T11:00:00Z'
  },
  {
    id: 'GC-2026-1038',
    serviceId: 'srv-9',
    serviceName: 'Deep Aromatherapy Relaxation Spa',
    date: '2026-09-22',
    time: '04:00 PM',
    customerName: 'Sarah Jenkins',
    customerEmail: 'demo@glowcare.com',
    customerPhone: '+1 (555) 234-5678',
    notes: 'Focus on neck and shoulder tension.',
    price: 120.00,
    status: 'Completed',
    createdAt: '2026-09-18T16:00:00Z'
  }
];

class GlowCareStore {
  constructor() {
    this.init();
  }

  init() {
    if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SERVICES)) {
      localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(DEFAULT_SERVICES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.APPOINTMENTS)) {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(DEFAULT_APPOINTMENTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CART)) {
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.FAVORITES)) {
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(['prod-1', 'prod-7']));
    }
    if (!localStorage.getItem(STORAGE_KEYS.THEME)) {
      localStorage.setItem(STORAGE_KEYS.THEME, 'light');
    }
    if (!localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
      // Default to demo user for seamless live demonstration
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(DEFAULT_USERS[0]));
    }
  }

  // --- PRODUCTS ---
  getProducts() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS)) || DEFAULT_PRODUCTS;
    } catch (e) {
      return DEFAULT_PRODUCTS;
    }
  }

  getProductById(id) {
    return this.getProducts().find(p => p.id === id) || null;
  }

  saveProduct(product) {
    const products = this.getProducts();
    const existingIndex = products.findIndex(p => p.id === product.id);
    if (existingIndex >= 0) {
      products[existingIndex] = { ...products[existingIndex], ...product };
    } else {
      product.id = 'prod-' + Date.now();
      products.unshift(product);
    }
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    return product;
  }

  deleteProduct(id) {
    let products = this.getProducts();
    products = products.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }

  // --- SERVICES ---
  getServices() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.SERVICES)) || DEFAULT_SERVICES;
    } catch (e) {
      return DEFAULT_SERVICES;
    }
  }

  getServiceById(id) {
    return this.getServices().find(s => s.id === id) || null;
  }

  saveService(service) {
    const services = this.getServices();
    const index = services.findIndex(s => s.id === service.id);
    if (index >= 0) {
      services[index] = { ...services[index], ...service };
    } else {
      service.id = 'srv-' + Date.now();
      services.push(service);
    }
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(services));
    return service;
  }

  deleteService(id) {
    let services = this.getServices();
    services = services.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(services));
  }

  // --- APPOINTMENTS ---
  getAppointments() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.APPOINTMENTS)) || DEFAULT_APPOINTMENTS;
    } catch (e) {
      return DEFAULT_APPOINTMENTS;
    }
  }

  getUserAppointments(userEmail) {
    const all = this.getAppointments();
    if (!userEmail) return [];
    return all.filter(a => a.customerEmail && a.customerEmail.toLowerCase() === userEmail.toLowerCase());
  }

  bookAppointment(data) {
    const all = this.getAppointments();
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const newAppointment = {
      id: `GC-${new Date().getFullYear()}-${randomCode}`,
      serviceId: data.serviceId,
      serviceName: data.serviceName,
      date: data.date,
      time: data.time,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      notes: data.notes || '',
      price: data.price || 0,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
    all.unshift(newAppointment);
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(all));
    return newAppointment;
  }

  updateAppointmentStatus(id, newStatus) {
    const all = this.getAppointments();
    const target = all.find(a => a.id === id);
    if (target) {
      target.status = newStatus;
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(all));
      return true;
    }
    return false;
  }

  cancelAppointment(id) {
    return this.updateAppointmentStatus(id, 'Cancelled');
  }

  deleteAppointment(id) {
    let all = this.getAppointments();
    all = all.filter(a => a.id !== id);
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(all));
  }

  // --- AUTH & USERS ---
  getUsers() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || DEFAULT_USERS;
    } catch (e) {
      return DEFAULT_USERS;
    }
  }

  getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) || null;
    } catch (e) {
      return null;
    }
  }

  login(email, password) {
    const users = this.getUsers();
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (found) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(found));
      return { success: true, user: found };
    }
    return { success: false, message: 'Invalid email or password.' };
  }

  signup(userData) {
    const users = this.getUsers();
    if (users.find(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
      return { success: false, message: 'An account with this email already exists.' };
    }
    const newUser = {
      id: 'usr-' + Date.now(),
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role: 'user',
      phone: userData.phone || '',
      skinType: userData.skinType || 'Unknown',
      primaryConcern: userData.primaryConcern || 'General Maintenance',
      joinedDate: new Date().toISOString().split('T')[0]
    };
    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));
    return { success: true, user: newUser };
  }

  logout() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }

  // --- SCAN HISTORY ---
  saveScan(scanData) {
    const scans = this.getScanHistory();
    const scanRecord = {
      id: 'scan-' + Date.now(),
      timestamp: new Date().toISOString(),
      ...scanData
    };
    scans.unshift(scanRecord);
    localStorage.setItem(STORAGE_KEYS.SCAN_HISTORY, JSON.stringify(scans));
    localStorage.setItem(STORAGE_KEYS.LAST_SCAN, JSON.stringify(scanRecord));
    return scanRecord;
  }

  getLastScan() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.LAST_SCAN)) || null;
    } catch (e) {
      return null;
    }
  }

  getScanHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.SCAN_HISTORY)) || [];
    } catch (e) {
      return [];
    }
  }

  // --- CART & FAVORITES ---
  getCart() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.CART)) || [];
    } catch (e) {
      return [];
    }
  }

  addToCart(productId, quantity = 1) {
    const cart = this.getCart();
    const item = cart.find(i => i.productId === productId);
    if (item) {
      item.quantity += quantity;
    } else {
      cart.push({ productId, quantity });
    }
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent('glowcare:cart_updated'));
    return cart;
  }

  removeFromCart(productId) {
    let cart = this.getCart();
    cart = cart.filter(i => i.productId !== productId);
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent('glowcare:cart_updated'));
    return cart;
  }

  updateCartQty(productId, qty) {
    const cart = this.getCart();
    const item = cart.find(i => i.productId === productId);
    if (item) {
      item.quantity = Math.max(1, qty);
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
      window.dispatchEvent(new CustomEvent('glowcare:cart_updated'));
    }
  }

  clearCart() {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify([]));
    window.dispatchEvent(new CustomEvent('glowcare:cart_updated'));
  }

  getFavorites() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES)) || [];
    } catch (e) {
      return [];
    }
  }

  isFavorite(productId) {
    return this.getFavorites().includes(productId);
  }

  toggleFavorite(productId) {
    let favs = this.getFavorites();
    if (favs.includes(productId)) {
      favs = favs.filter(id => id !== productId);
    } else {
      favs.push(productId);
    }
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favs));
    window.dispatchEvent(new CustomEvent('glowcare:favorites_updated'));
    return favs.includes(productId);
  }

  // --- THEME ---
  getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
  }

  setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
  }

  toggleTheme() {
    const next = this.getTheme() === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
    return next;
  }

  // --- CONTACT MESSAGES ---
  saveContactMessage(message) {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]');
    const record = {
      id: 'msg-' + Date.now(),
      createdAt: new Date().toISOString(),
      ...message
    };
    list.unshift(record);
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(list));
    return record;
  }

  getContactMessages() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES)) || [];
    } catch (e) {
      return [];
    }
  }
}

// Global Store Instance
window.store = new GlowCareStore();
