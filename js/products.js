/* =========================================================
   Product catalog — the single source of truth for names,
   prices, copy and imagery. Loaded on every page.

   Kept as a plain script (not JSON + fetch) so the site also
   works when opened directly from disk (file://). The Netlify
   checkout function imports this same file, so prices charged
   by Stripe always come from here — never from the browser.

   All copy is original and uses cosmetic language only.
   Prices are in USD.
========================================================= */
(function () {
    "use strict";

    var root = typeof window !== "undefined" ? window : globalThis;
    var GLOWW = (root.GLOWW = root.GLOWW || {});

    GLOWW.config = {
        currency: "USD",
        locale: "en-US",
        freeShippingThreshold: 50,
        standardShipping: 6.95,
        maxQuantity: 10,
        /* Netlify Functions (see netlify/functions/) */
        checkoutEndpoint: "/api/create-checkout-session",
        checkoutStatusEndpoint: "/api/checkout-status"
    };

    GLOWW.categories = [
        { id: "cleansers", label: "Cleansers", area: "face" },
        { id: "serums", label: "Serums", area: "face" },
        { id: "moisturizers", label: "Moisturizers", area: "face" },
        { id: "eye-care", label: "Eye Care", area: "face" },
        { id: "body", label: "Body & Sun", area: "body" },
        { id: "makeup", label: "Makeup", area: "makeup" },
        { id: "men", label: "Men", area: "men" },
        { id: "sets", label: "Sets", area: "sets" }
    ];

    /* Broader collections used by the shop tiles (the original Product.html categories) */
    GLOWW.areas = [
        { id: "face", label: "Face" },
        { id: "body", label: "Body" },
        { id: "men", label: "Men" },
        { id: "makeup", label: "Makeup" },
        { id: "sets", label: "Sets" }
    ];

    GLOWW.benefits = [
        { id: "hydration", label: "Hydration" },
        { id: "radiance", label: "Radiance" },
        { id: "nourishment", label: "Nourishment" },
        { id: "comfort", label: "Comfort" },
        { id: "firming", label: "Firming look" }
    ];

    /* Each product image is an original GLOWW packshot (tools/generate-packshots.py) */
    GLOWW.products = [
        {
            id: "rose-hydration-serum",
            name: "Rose Hydration Serum",
            category: "serums",
            price: 52,
            size: "30 ml",
            badge: "Bestseller",
            bestseller: true,
            benefits: ["hydration", "radiance"],
            images: [{ src: "Images/products/rose-hydration-serum.webp", w: 1000, h: 1250, alt: "GLOWW Rose Hydration Serum in a blush-pink glass dropper bottle with a gold collar" }],
            short: "A water-light serum that leaves skin feeling supple, quenched and softly radiant.",
            description: "Our everyday hydration step. A fluid, fast-sinking serum of rose water, humectants and plant-derived glycerin, designed to help skin feel plump and comfortable from morning to night. It disappears under moisturizer and makeup without a trace.",
            highlights: ["Helps skin feel hydrated and supple", "Weightless, non-sticky finish", "Layers easily under cream and sunscreen"],
            ingredients: [
                { name: "Hyaluronic acid", note: "A humectant that helps draw water to the skin's surface." },
                { name: "Rose water", note: "Gives the serum its fresh, delicate floral character." },
                { name: "Plant glycerin", note: "Keeps the texture cushiony and helps skin feel soft." }
            ],
            howTo: "Morning and evening, warm two or three drops between your fingertips and press gently over clean face and neck. Follow with your moisturizer."
        },
        {
            id: "revitalizing-eye-serum",
            name: "Revitalizing Eye Serum",
            category: "eye-care",
            price: 46,
            size: "15 ml",
            badge: "Bestseller",
            bestseller: true,
            benefits: ["radiance", "firming"],
            images: [{ src: "Images/products/revitalizing-eye-serum.webp", w: 1000, h: 1250, alt: "GLOWW Revitalizing Eye Serum, a slim terracotta pen with a gold cooling applicator tip" }],
            short: "A cooling gel-serum for an eye area that looks rested and bright.",
            description: "A light gel-serum made for the delicate skin around the eyes. A cooling applicator, caffeine and cornflower water come together in a quick morning ritual that helps the eye contour look fresher, smoother and more awake.",
            highlights: ["Cool applicator feels instantly refreshing", "Helps the eye area look brighter and more rested", "Sits comfortably under concealer"],
            ingredients: [
                { name: "Caffeine", note: "A familiar eye-care ingredient prized for its refreshing feel." },
                { name: "Cornflower water", note: "A gentle floral water that keeps the formula soft and soothing." },
                { name: "Niacinamide", note: "Helps skin tone look more even." }
            ],
            howTo: "Glide the applicator from the inner to the outer corner beneath each eye, then along the brow bone. Pat in lightly with your ring finger. Morning and evening."
        },
        {
            id: "hydra-veil-gel-cream",
            name: "Hydra-Veil Gel Cream",
            category: "moisturizers",
            price: 48,
            size: "50 ml",
            badge: "Bestseller",
            bestseller: true,
            benefits: ["hydration", "comfort"],
            images: [{ src: "Images/products/hydra-veil-gel-cream.webp", w: 1000, h: 1250, alt: "GLOWW Hydra-Veil Gel Cream in a sea-glass green jar with an ivory lid" }],
            short: "A cool, bouncy gel cream that melts into a fresh, hydrated finish.",
            description: "A cloud-light gel cream for anyone who wants moisture without weight. It breaks into fresh droplets on contact, leaving skin feeling quenched and comfortable with a soft, natural finish — ideal on warm days or under makeup.",
            highlights: ["Refreshing, water-gel texture", "Leaves skin feeling hydrated for hours", "Fresh, non-greasy finish"],
            ingredients: [
                { name: "Hyaluronic acid", note: "Helps draw water to the skin's surface." },
                { name: "Cucumber extract", note: "Brings a fresh, cooling sensation." },
                { name: "Squalane", note: "A lightweight emollient that helps skin feel smooth." }
            ],
            howTo: "Smooth a small amount over face and neck after your serum, morning and/or evening."
        },
        {
            id: "dual-botanical-serum",
            name: "Dual Botanical Serum",
            category: "serums",
            price: 85,
            size: "50 ml",
            badge: "Signature",
            bestseller: true,
            benefits: ["radiance", "firming", "nourishment"],
            images: [{ src: "Images/products/dual-botanical-serum.webp", w: 1000, h: 1250, alt: "GLOWW Dual Botanical Serum, a twin-chamber amber and gold pump bottle" }],
            short: "Two phases, one ritual: a water serum and a botanical oil blended fresh with every pump.",
            description: "Our signature treatment serum keeps a hydrating water phase and a nourishing oil phase in separate chambers, combining them only as you dispense. The result is a silky, fast-absorbing serum that helps skin look smoother, more radiant and more even.",
            highlights: ["Helps skin look smoother and more radiant", "Water and oil phases blended fresh", "Silky texture, no sticky residue"],
            ingredients: [
                { name: "Turmeric root extract", note: "A golden botanical valued for its brightening appearance." },
                { name: "Squalane", note: "Helps skin feel soft and supple." },
                { name: "Hyaluronic acid", note: "Helps skin feel hydrated." }
            ],
            howTo: "Morning and evening, dispense one pump into your palms, warm, and press over face and neck before moisturizer."
        },
        {
            id: "gentle-foaming-cleanser",
            name: "Gentle Foaming Cleanser",
            category: "cleansers",
            price: 28,
            size: "125 ml",
            benefits: ["comfort"],
            images: [{ src: "Images/products/gentle-foaming-cleanser.webp", w: 1000, h: 1250, alt: "GLOWW Gentle Foaming Cleanser in a cream tube with a forest-green cap" }],
            short: "A soft, cushiony foam that cleanses without leaving skin feeling tight.",
            description: "A creamy gel that whips into a fine, airy foam. It lifts away the day's impurities and makeup traces while leaving skin feeling soft, fresh and comfortable — never stripped.",
            highlights: ["Cleanses without a tight feeling", "Fine, cushiony foam", "Suitable for morning and evening"],
            ingredients: [
                { name: "Oat extract", note: "Known for its soothing, comforting feel." },
                { name: "Coconut-derived cleansers", note: "Gentle surfactants that create a soft lather." },
                { name: "Glycerin", note: "Helps skin feel soft after rinsing." }
            ],
            howTo: "Work a small amount into a lather with lukewarm water, massage over damp skin, then rinse thoroughly."
        },
        {
            id: "midnight-renewal-night-cream",
            name: "Midnight Renewal Night Cream",
            category: "moisturizers",
            price: 62,
            size: "50 ml",
            benefits: ["nourishment", "firming"],
            images: [{ src: "Images/products/midnight-renewal-night-cream.webp", w: 1000, h: 1250, alt: "GLOWW Midnight Renewal Night Cream in a deep navy jar with a gold lid" }],
            short: "A rich-yet-breathable night cream for skin that looks rested by morning.",
            description: "A comforting overnight cream with a velvet texture. Plant oils and peptides wrap skin in moisture while you sleep, so you wake to a complexion that looks smoother, softer and visibly rested.",
            highlights: ["Skin feels nourished and soft by morning", "Helps skin look smoother", "Velvety, non-greasy texture"],
            ingredients: [
                { name: "Peptides", note: "Commonly used to help skin look firmer and smoother." },
                { name: "Shea butter", note: "A rich emollient that helps skin feel comforted." },
                { name: "Evening primrose oil", note: "A nourishing botanical oil." }
            ],
            howTo: "In the evening, warm a pea-sized amount between your palms and press over face and neck after serum."
        },
        {
            id: "apricot-comfort-day-cream",
            name: "Apricot Comfort Day Cream",
            category: "moisturizers",
            price: 54,
            size: "50 ml",
            benefits: ["comfort", "nourishment"],
            images: [{ src: "Images/products/apricot-comfort-day-cream.webp", w: 1000, h: 1250, alt: "GLOWW Apricot Comfort Day Cream in a soft apricot jar with a rose-gold lid" }],
            short: "A softly nourishing day cream for skin that craves comfort.",
            description: "Made with sensitive-feeling skin in mind, this cream has a cushiony texture that sinks in to leave skin calm, comfortable and supple. A gentle choice for days when your skin asks for simplicity.",
            highlights: ["Helps skin feel calm and comfortable", "Fragrance-free formula", "Soft, cushiony texture"],
            ingredients: [
                { name: "Apricot kernel oil", note: "A light, nourishing oil." },
                { name: "Ceramides", note: "Help support the skin's natural moisture barrier." },
                { name: "Oat extract", note: "Known for its comforting feel." }
            ],
            howTo: "Each morning, smooth over face and neck after serum. Patch test before first use if your skin is sensitive."
        },
        {
            id: "velvet-firming-day-cream",
            name: "Velvet Firming Day Cream",
            category: "moisturizers",
            price: 68,
            size: "50 ml",
            benefits: ["firming", "hydration"],
            images: [{ src: "Images/products/velvet-firming-day-cream.webp", w: 1000, h: 1250, alt: "GLOWW Velvet Firming Day Cream in a garnet jar with a gold lid" }],
            short: "A sculpting day cream for skin that looks firmer and more defined.",
            description: "A smooth, velvety cream that helps skin look firmer and more toned through the day. Botanical extracts and hydrating actives leave the complexion feeling supple with a refined, satin finish.",
            highlights: ["Helps skin look firmer and more defined", "Satin finish, primes for makeup", "Hydrates through the day"],
            ingredients: [
                { name: "Peptides", note: "Help skin look firmer and smoother." },
                { name: "Hibiscus extract", note: "A botanical extract used for a supple-looking complexion." },
                { name: "Hyaluronic acid", note: "Helps skin feel hydrated." }
            ],
            howTo: "Apply morning cream in upward strokes from the base of the neck to the forehead."
        },
        {
            id: "tinted-glow-oil-serum",
            name: "Tinted Glow Oil-Serum",
            category: "makeup",
            price: 44,
            size: "30 ml",
            benefits: ["radiance", "nourishment"],
            images: [{ src: "Images/products/tinted-glow-oil-serum.webp", w: 1000, h: 1250, alt: "GLOWW Tinted Glow Oil-Serum in a warm beige dropper bottle" }],
            short: "Sheer colour in a nourishing oil-serum for a healthy-looking glow.",
            description: "Part skincare, part complexion. A featherlight wash of buildable colour suspended in nourishing oils evens the look of skin while letting it show through — a fresh, lit-from-within finish.",
            highlights: ["Sheer, buildable coverage", "Healthy-looking, luminous finish", "Nourishing oil-serum base"],
            ingredients: [
                { name: "Jojoba oil", note: "A lightweight oil that helps skin feel soft." },
                { name: "Mineral pigments", note: "Give sheer, natural-looking colour." },
                { name: "Vitamin E", note: "An antioxidant that helps protect the formula." }
            ],
            howTo: "Shake well. Dot a few drops onto the face and blend outward with fingertips or a brush. Layer for more coverage."
        },
        {
            id: "hydrating-lip-colour",
            name: "Hydrating Lip Colour",
            category: "makeup",
            price: 32,
            size: "3.5 g",
            benefits: ["nourishment"],
            images: [{ src: "Images/products/hydrating-lip-colour.webp", w: 1000, h: 1250, alt: "GLOWW Hydrating Lip Colour, a coral lipstick in a gold case" }],
            short: "Satin colour with a balm-like feel that keeps lips comfortable.",
            description: "A creamy lipstick that glides on in one stroke and stays comfortable all day. Plant butters cushion the lips while the colour wears down evenly with a soft satin sheen.",
            highlights: ["Comfortable, balm-like feel", "Satin finish", "Even, buildable colour"],
            ingredients: [
                { name: "Shea butter", note: "Helps lips feel soft." },
                { name: "Mango seed butter", note: "Adds a cushiony glide." },
                { name: "Castor seed oil", note: "Gives a satin shine." }
            ],
            howTo: "Apply directly from the bullet, starting at the centre of the lips and working outwards."
        },
        {
            id: "sunkissed-glow-drops",
            name: "Sunkissed Glow Drops",
            category: "body",
            price: 36,
            size: "15 ml",
            benefits: ["radiance"],
            images: [{ src: "Images/products/sunkissed-glow-drops.webp", w: 1000, h: 1250, alt: "GLOWW Sunkissed Glow Drops in a small amber dropper bottle" }],
            short: "Mix-in drops for a gradual, natural-looking sun-kissed tone.",
            description: "Add a few drops to your usual moisturizer for a soft, believable tan that develops over a few hours. Easy to adjust — fewer drops for a hint of warmth, more for a deeper glow.",
            highlights: ["Buildable, natural-looking tan", "Mixes into your usual moisturizer", "Develops gradually over a few hours"],
            ingredients: [
                { name: "Plant-derived DHA", note: "Interacts with the skin's surface to create a tanned appearance." },
                { name: "Aloe vera", note: "Adds a comforting feel." },
                { name: "Vitamin E", note: "An antioxidant that helps protect the formula." }
            ],
            howTo: "Mix 2–4 drops with your moisturizer and apply evenly. Wash hands after use. Self-tan does not protect against the sun."
        },
        {
            id: "after-sun-body-lotion",
            name: "After-Sun Body Lotion",
            category: "body",
            price: 34,
            size: "150 ml",
            benefits: ["hydration", "comfort"],
            images: [{ src: "Images/products/after-sun-body-lotion.webp", w: 1000, h: 1250, alt: "GLOWW After-Sun Body Lotion in a pale yellow pump bottle" }],
            short: "A cooling, quick-absorbing lotion for skin after time outdoors.",
            description: "A light, cooling lotion that leaves sun-exposed skin feeling soothed, soft and hydrated. Absorbs quickly so you can dress straight away.",
            highlights: ["Cooling, comforting feel", "Leaves skin soft and hydrated", "Absorbs quickly"],
            ingredients: [
                { name: "Aloe vera", note: "Gives a fresh, cooling sensation." },
                { name: "Sunflower seed oil", note: "Helps skin feel nourished." },
                { name: "Panthenol", note: "Helps skin feel comfortable." }
            ],
            howTo: "Smooth generously over the body after sun exposure or after your shower."
        },
        {
            id: "restorative-hand-cream",
            name: "Restorative Hand Cream",
            category: "body",
            price: 30,
            size: "100 ml",
            benefits: ["nourishment", "comfort"],
            images: [{ src: "Images/products/restorative-hand-cream.webp", w: 1000, h: 1250, alt: "GLOWW Restorative Hand Cream in a blush tube with a gold cap" }],
            short: "A rich hand cream that leaves hands soft without a greasy feel.",
            description: "A concentrated, quick-absorbing cream for hands that work hard. Shea butter and plant oils leave skin feeling soft and comfortable, while a satin finish means you can carry on with your day straight away.",
            highlights: ["Hands feel soft and nourished", "Absorbs quickly, no greasy residue", "Cares for cuticles too"],
            ingredients: [
                { name: "Shea butter", note: "Helps hands feel soft and comforted." },
                { name: "Sesame oil", note: "A light, nourishing oil." },
                { name: "Glycerin", note: "Helps skin feel hydrated." }
            ],
            howTo: "Massage into hands and cuticles as often as needed."
        },
        {
            id: "botanical-body-collection",
            name: "Botanical Body Collection",
            category: "sets",
            price: 88,
            size: "4 pieces",
            badge: "Gift set",
            benefits: ["nourishment", "radiance"],
            images: [{ src: "Images/products/botanical-body-collection.webp", w: 1000, h: 1250, alt: "GLOWW Botanical Body Collection: body cream, body oil, botanical mist and lip oil" }],
            short: "A body cream, treatment oil, fragrance mist and lip oil, gathered in one gift.",
            description: "A complete body ritual: a silky body cream, a nourishing treatment oil, a fresh botanical mist and a lip oil to finish. Thoughtfully gathered for gifting — or for keeping.",
            highlights: ["Four full rituals in one gift", "Fresh, green botanical scent", "Leaves skin soft and radiant-looking"],
            ingredients: [
                { name: "Plant oils", note: "A blend of nourishing botanical oils." },
                { name: "Shea butter", note: "Helps skin feel comforted." },
                { name: "Green tea extract", note: "Adds a fresh botanical note." }
            ],
            howTo: "Use the oil on damp skin after bathing, follow with the cream, and finish with a veil of mist."
        },
        {
            id: "hand-cream-trio",
            name: "Hand Cream Trio",
            category: "sets",
            price: 39,
            size: "3 × 30 ml",
            badge: "Gift set",
            benefits: ["nourishment"],
            images: [{ src: "Images/products/hand-cream-trio.webp", w: 1000, h: 1250, alt: "GLOWW Hand Cream Trio: three tubes in lime, orange and grapefruit" }],
            short: "Three travel-size hand creams in fresh citrus scents.",
            description: "Our Restorative Hand Cream texture in three bright, limited-edition scents — lime, orange and grapefruit. Sized for handbags, desks and travel, and easy to share.",
            highlights: ["Three fresh citrus scents", "Travel-friendly sizes", "Leaves hands soft and comfortable"],
            ingredients: [
                { name: "Shea butter", note: "Helps hands feel soft." },
                { name: "Citrus extracts", note: "Give each tube its fresh scent." },
                { name: "Glycerin", note: "Helps skin feel hydrated." }
            ],
            howTo: "Massage into hands and cuticles whenever they need comfort."
        },
        {
            id: "smooth-shave-gel",
            name: "Smooth Shave Gel",
            category: "men",
            price: 26,
            size: "150 ml",
            benefits: ["comfort"],
            images: [{ src: "Images/products/smooth-shave-gel.webp", w: 1000, h: 1250, alt: "GLOWW Smooth Shave Gel in a forest-green bottle with a black cap" }],
            short: "A transparent shave gel for a close, comfortable shave.",
            description: "A clear, non-foaming gel that lets you see exactly where you shave. It helps the razor glide for a close, comfortable result and leaves skin feeling fresh rather than tight.",
            highlights: ["Clear gel for precise shaving", "Helps the razor glide", "Leaves skin feeling fresh"],
            ingredients: [
                { name: "Aloe vera", note: "Adds a comforting feel." },
                { name: "Glycerin", note: "Helps skin feel soft." },
                { name: "Menthol", note: "Gives a cooling, fresh sensation." }
            ],
            howTo: "Apply a thin layer to damp skin, shave in the direction of hair growth, then rinse with cool water."
        }
    ];

    /* ---------- Lookups ---------- */

    var byId = {};
    GLOWW.products.forEach(function (product, index) {
        product.order = index;
        product.area = categoryOf(product.category).area;
        byId[product.id] = product;
    });

    function categoryOf(id) {
        for (var i = 0; i < GLOWW.categories.length; i++) {
            if (GLOWW.categories[i].id === id) return GLOWW.categories[i];
        }
        return { id: id, label: id, area: id };
    }

    GLOWW.getProduct = function (id) {
        return Object.prototype.hasOwnProperty.call(byId, id) ? byId[id] : null;
    };

    GLOWW.getCategory = categoryOf;

    GLOWW.labelFor = function (list, id) {
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === id) return list[i].label;
        }
        return null;
    };

    /* Free-text search across name, category, benefits, description and ingredients */
    GLOWW.searchProducts = function (query) {
        var terms = String(query || "").toLowerCase().trim().split(/\s+/).filter(Boolean);
        if (!terms.length) return GLOWW.products.slice();
        return GLOWW.products.filter(function (product) {
            var haystack = [
                product.name,
                categoryOf(product.category).label,
                product.area,
                product.short,
                product.description,
                product.benefits.join(" "),
                product.ingredients.map(function (ing) { return ing.name; }).join(" ")
            ].join(" ").toLowerCase();
            return terms.every(function (term) { return haystack.indexOf(term) !== -1; });
        });
    };

    /* Ritual routines featured on the homepage and journal */
    GLOWW.rituals = {
        morning: ["gentle-foaming-cleanser", "rose-hydration-serum", "revitalizing-eye-serum", "hydra-veil-gel-cream"],
        evening: ["gentle-foaming-cleanser", "dual-botanical-serum", "midnight-renewal-night-cream"]
    };

    /* Server-side use (Netlify Functions) */
    if (typeof module === "object" && module.exports) module.exports = GLOWW;
})();
