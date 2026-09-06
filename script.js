const $ = id => document.getElementById(id);

const STORAGE = {
    profile: "smartmeal_profile_v6",
    plan: "smartmeal_plan_v6",
    grocery: "smartmeal_grocery_v6",
    theme: "smartmeal_theme_v6"
};

const fieldIds = [
    "age","gender","height","weight","goal","dietary-preference","regional-cuisine",
    "likes","allergies","health-conditions","activity","workout-schedule","budget",
    "meals-per-day","cooking-time"
];

const mealBank = {
    "North Indian": {
        breakfast: ["Vegetable poha + curd", "Besan chilla + mint chutney", "Aloo-free vegetable paratha + curd", "Moong dal cheela + chutney", "Oats upma + fruit", "Paneer bhurji toast", "Vegetable daliya + curd"],
        lunch: ["Dal + 2 roti + cucumber salad", "Rajma + brown rice + salad", "Chole + 2 roti + salad", "Moong dal khichdi + raita", "Palak paneer + 2 roti", "Dal tadka + jeera rice + salad", "Kadhi + rice + salad"],
        dinner: ["Paneer tikka + roti + salad", "Mixed veg + dal + roti", "Lauki chana dal + roti", "Vegetable pulao + raita", "Tandoori chicken + salad", "Soya chunk curry + roti", "Dal + mixed vegetables + roti"],
        snack: ["Fruit + roasted chana", "Buttermilk + makhana", "Apple + a small handful of nuts", "Sprouts chaat", "Guava + roasted chana"]
    },
    "South Indian": {
        breakfast: ["Idli + sambar", "Vegetable dosa + sambar", "Vegetable upma + coconut chutney", "Pesarattu + chutney", "Oats idli + sambar", "Ven pongal + sambar", "Ragi dosa + sambar"],
        lunch: ["Sambar rice + poriyal", "Curd rice + vegetable curry", "Rasam + rice + beans poriyal", "Lemon rice + dal + salad", "Vegetable sambar + brown rice", "Tomato rice + egg curry", "Khichdi + vegetable poriyal"],
        dinner: ["Vegetable uttapam + sambar", "Ragi dosa + vegetable curry", "Paneer/soya stir-fry + rice", "Sambar + 2 dosa", "Vegetable soup + idli", "Dal + rice + poriyal", "Curd rice + vegetables"],
        snack: ["Fruit + peanuts", "Buttermilk + roasted chana", "Sundal", "Coconut water + nuts", "Fruit bowl"]
    },
    "Generic Indian": {
        breakfast: ["Vegetable oats + fruit", "Moong dal chilla + chutney", "Poha + curd", "Idli + sambar", "Besan chilla + fruit", "Vegetable upma + curd", "Daliya + nuts"],
        lunch: ["Dal + rice + salad", "Chole + roti + salad", "Rajma + rice + vegetables", "Khichdi + curd", "Paneer curry + roti", "Dal + vegetable pulao", "Sambar + rice + salad"],
        dinner: ["Mixed vegetable curry + roti", "Paneer/tofu tikka + salad", "Dal + roti + vegetables", "Vegetable khichdi + raita", "Soya curry + roti", "Soup + paneer/tofu + roti", "Dal + rice + salad"],
        snack: ["Fruit + roasted chana", "Makhana", "Sprouts chaat", "Buttermilk + nuts", "Fruit + seeds"]
    }
};

function init() {
    loadSavedState();
    $("user-form").addEventListener("submit", e => {
        e.preventDefault();
        generateMealPlan();
    });
    $("theme-toggle").addEventListener("click", toggleTheme);
    $("reset-grocery-list").addEventListener("click", resetGroceryList);
}

function getProfile() {
    const p = {};
    fieldIds.forEach(id => {
        const el = $(id);
        p[id] = el.type === "number" ? Number(el.value) : el.value;
    });
    return p;
}

function isProfileValid(p) {
    return p.age >= 13 && p.age <= 100 && p.height >= 100 && p.weight >= 25;
}

function calculateNutrition(p) {
    const bmr = p.gender === "Male"
        ? 10*p.weight + 6.25*p.height - 5*p.age + 5
        : 10*p.weight + 6.25*p.height - 5*p.age - 161;

    const activityFactor = { Low:1.2, Moderate:1.45, High:1.65 }[p.activity] || 1.2;
    let calories = bmr * activityFactor;
    if (p.goal === "Weight Loss") calories -= 350;
    if (p.goal === "Weight Gain") calories += 300;
    if (p.goal === "Muscle Gain") calories += 200;
    calories = Math.max(1200, Math.round(calories));

    let protein = p.goal === "Muscle Gain" ? p.weight * 1.6 :
                  p.goal === "Weight Loss" ? p.weight * 1.3 : p.weight * 1.1;
    protein = Math.round(protein);

    const bmi = p.weight / Math.pow(p.height/100, 2);
    return { calories, protein, bmi: bmi.toFixed(1), bmr: Math.round(bmr) };
}

function renderNutritionSummary(n, p) {
    $("calories").textContent = `${n.calories} kcal`;
    $("protein").textContent = `${n.protein} g`;
    $("bmi").textContent = n.bmi;
    $("goal-label").textContent = p.goal;
    $("nutrition-note").textContent =
        "These are general estimates. Individual needs vary, and health conditions may require guidance from a qualified professional.";
    $("nutrition-summary").classList.remove("hidden");
}

function dietaryFilter(meal, p) {
    const text = meal.toLowerCase();
    const avoid = (p.allergies || "").toLowerCase().split(",").map(x=>x.trim()).filter(Boolean);
    if (avoid.some(a => a && text.includes(a))) return false;
    if (p["dietary-preference"] === "Vegan" && /(curd|paneer|chicken|egg|raita|buttermilk)/i.test(meal)) return false;
    if (p["dietary-preference"] === "Jain" && /(onion|garlic)/i.test(meal)) return false;
    if (p["dietary-preference"] === "Eggitarian" && /(chicken|tandoori chicken)/i.test(meal)) return false;
    if (p["dietary-preference"] === "Pure Veg" && /(chicken)/i.test(meal)) return false;
    return true;
}

function chooseMeal(list, p, used) {
    const filtered = list.filter(m => dietaryFilter(m,p));
    const liked = (p.likes || "").toLowerCase();
    const preferred = filtered.filter(m => liked && liked.split(",").some(x => x.trim() && m.toLowerCase().includes(x.trim())));
    const pool = preferred.length ? preferred : filtered.length ? filtered : list;
    let meal = pool[Math.floor(Math.random()*pool.length)];
    for (let i=0; i<5 && used.has(meal); i++) meal = pool[Math.floor(Math.random()*pool.length)];
    used.add(meal);
    return meal;
}

function createMealPlan(p) {
    const cuisine = mealBank[p["regional-cuisine"]] || mealBank["Generic Indian"];
    const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
    const count = Number(p["meals-per-day"]);
    const result = [];
    const used = new Set();

    days.forEach((day, i) => {
        const meals = [
            {time:"Breakfast", name:chooseMeal(cuisine.breakfast,p,used)},
            {time:"Lunch", name:chooseMeal(cuisine.lunch,p,used)},
            {time:"Dinner", name:chooseMeal(cuisine.dinner,p,used)}
        ];
        if (count >= 4) meals.splice(2,0,{time:"Snack",name:chooseMeal(cuisine.snack,p,used)});
        if (count >= 5) meals.push({time:"Evening Snack",name:chooseMeal(cuisine.snack,p,used)});
        if (count >= 6) meals.splice(3,0,{time:"Mini Meal",name:chooseMeal(cuisine.snack,p,used)});
        result.push({day, meals});
    });
    return result;
}

function renderMealPlan(plan) {
    $("days").innerHTML = plan.map((d,i) => `
        <article class="day-card">
            <div class="day-title"><span>Day ${i+1} · ${d.day}</span><span>🥗</span></div>
            ${d.meals.map(m => `
                <div class="meal">
                    <div class="meal-top"><span class="meal-name">${escapeHTML(m.name)}</span><span class="meal-time">${m.time}</span></div>
                    <p class="meal-desc">Balanced portion • Indian-style • Adjust salt/oil to preference</p>
                </div>`).join("")}
        </article>
    `).join("");
    $("meal-plan").classList.remove("hidden");
}

function renderMacros(n, plan) {
    const targets = [
        {name:"Calories", value:n.calories, unit:"kcal", pct:100},
        {name:"Protein", value:n.protein, unit:"g", pct:70},
        {name:"Carbs", value:Math.round(n.calories*.45/4), unit:"g", pct:55},
        {name:"Fat", value:Math.round(n.calories*.30/9), unit:"g", pct:30}
    ];
    $("macros").innerHTML = targets.map(x => `
        <div class="macro-row">
            <strong>${x.name}</strong>
            <div class="macro-bar"><div class="macro-fill" style="width:${x.pct}%"></div></div>
            <span>${x.value} ${x.unit}</span>
        </div>`).join("");
    $("daily-summary").classList.remove("hidden");
}

function buildGroceries(plan) {
    const all = plan.flatMap(d => d.meals.map(m => m.name.toLowerCase()));
    const categories = {
        "🥬 Vegetables": ["onion","tomato","spinach","palak","lauki","beans","vegetable","cucumber","lemon","mint","poriyal"],
        "🌾 Grains & Staples": ["rice","roti","poha","oats","daliya","idli","dosa","upma","ragi","pulao"],
        "🥛 Dairy & Alternatives": ["curd","paneer","raita","buttermilk","tofu"],
        "💪 Protein": ["dal","rajma","chole","chana","moong","soya","sprouts","egg","chicken"],
        "🍎 Fruits & Snacks": ["fruit","apple","guava","banana","makhana","nuts","peanuts","seeds","coconut"]
    };
    const fallback = ["Cooking oil","Salt & spices","Ginger","Green chilli"];
    const groceries = {};
    Object.keys(categories).forEach(cat => groceries[cat] = []);
    groceries["🧂 Pantry"] = fallback.slice();

    const ingredients = new Set();
    all.forEach(t => {
        Object.keys(categories).forEach(cat => {
            categories[cat].forEach(key => {
                if (t.includes(key)) ingredients.add(key);
            });
        });
    });
    ingredients.forEach(x => {
        const cat = Object.keys(categories).find(c => categories[c].includes(x)) || "🧂 Pantry";
        groceries[cat].push(x.charAt(0).toUpperCase()+x.slice(1));
    });
    Object.keys(groceries).forEach(cat => groceries[cat] = [...new Set(groceries[cat])].sort());

    localStorage.setItem(STORAGE.grocery, JSON.stringify(groceries));
    renderGroceries(groceries);
}

function renderGroceries(groceries) {
    const checked = JSON.parse(localStorage.getItem(STORAGE.grocery+"_checked") || "{}");
    $("grocery-category").innerHTML = Object.entries(groceries).map(([cat,items]) => `
        <div class="grocery-category">
            <h3>${cat}</h3>
            ${items.map(item => {
                const key = cat+"_"+item;
                return `<label class="grocery-item ${checked[key] ? "done":""}">
                    <input type="checkbox" data-grocery="${escapeHTML(key)}" ${checked[key] ? "checked":""}>
                    <span>${escapeHTML(item)}</span>
                </label>`;
            }).join("")}
        </div>`).join("");

    document.querySelectorAll("[data-grocery]").forEach(cb => {
        cb.addEventListener("change", () => {
            const data = JSON.parse(localStorage.getItem(STORAGE.grocery+"_checked") || "{}");
            data[cb.dataset.grocery] = cb.checked;
            localStorage.setItem(STORAGE.grocery+"_checked", JSON.stringify(data));
            cb.parentElement.classList.toggle("done", cb.checked);
        });
    });
    $("grocery-checklist").classList.remove("hidden");
}

function generateMealPlan() {
    const p = getProfile();
    if (!isProfileValid(p)) {
        $("error-message").textContent = "Please enter a valid age, height and weight.";
        return;
    }
    $("error-message").textContent = "";
    const n = calculateNutrition(p);
    const plan = createMealPlan(p);
    renderNutritionSummary(n,p);
    renderMealPlan(plan);
    renderMacros(n,plan);
    buildGroceries(plan);
    localStorage.setItem(STORAGE.profile, JSON.stringify(p));
    localStorage.setItem(STORAGE.plan, JSON.stringify(plan));
    window.scrollTo({top:$("nutrition-summary").offsetTop-70, behavior:"smooth"});
}

function resetGroceryList() {
    localStorage.removeItem(STORAGE.grocery+"_checked");
    const groceries = JSON.parse(localStorage.getItem(STORAGE.grocery) || "{}");
    renderGroceries(groceries);
}

function toggleTheme() {
    const dark = !document.body.classList.contains("dark");
    document.body.classList.toggle("dark", dark);
    $("theme-toggle").textContent = dark ? "☀️" : "🌙";
    localStorage.setItem(STORAGE.theme, dark ? "dark" : "light");
}

function loadSavedState() {
    const theme = localStorage.getItem(STORAGE.theme);
    if (theme === "dark") {
        document.body.classList.add("dark");
        $("theme-toggle").textContent = "☀️";
    }

    const p = JSON.parse(localStorage.getItem(STORAGE.profile) || "null");
    if (p) fieldIds.forEach(id => { if ($(id) && p[id] !== undefined) $(id).value = p[id]; });

    const plan = JSON.parse(localStorage.getItem(STORAGE.plan) || "null");
    if (p && plan) {
        const n = calculateNutrition(p);
        renderNutritionSummary(n,p);
        renderMealPlan(plan);
        renderMacros(n,plan);
        const groceries = JSON.parse(localStorage.getItem(STORAGE.grocery) || "null");
        if (groceries) renderGroceries(groceries);
        else buildGroceries(plan);
    }
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, c => ({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
}

document.addEventListener("DOMContentLoaded", init);
