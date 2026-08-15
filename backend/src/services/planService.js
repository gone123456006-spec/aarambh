const { slugifyLevel } = require('../constants/curriculum');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { CATEGORIES } = SubscriptionPlan;

const DEFAULT_PLANS = [
  { category: 'beginner', title: 'Beginner', price: 99, enabled: false, durationDays: 30 },
  { category: 'intermediate', title: 'Intermediate', price: 249, enabled: true, durationDays: 30 },
  { category: 'advanced', title: 'Advanced', price: 249, enabled: true, durationDays: 30 },
];

async function ensureDefaultPlans() {
  for (const plan of DEFAULT_PLANS) {
    await SubscriptionPlan.updateOne(
      { category: plan.category },
      { $setOnInsert: plan },
      { upsert: true }
    );
  }
}

async function listPlans() {
  await ensureDefaultPlans();
  return SubscriptionPlan.find({}).sort({ category: 1 }).lean();
}

async function getPlan(category) {
  await ensureDefaultPlans();
  let slug = slugifyLevel(category);
  if (!CATEGORIES.includes(slug)) {
    if (slug.includes('beginner')) slug = 'beginner';
    else if (slug.includes('intermediate')) slug = 'intermediate';
    else if (slug.includes('advanced')) slug = 'advanced';
    else return null;
  }
  return SubscriptionPlan.findOne({ category: slug });
}

function isPaidCategory(plan) {
  return Boolean(plan && plan.enabled && Number(plan.price) > 0);
}

async function updatePlan(category, updates) {
  const plan = await getPlan(category);
  if (!plan) {
    const err = new Error('Subscription plan not found');
    err.statusCode = 404;
    throw err;
  }

  if (updates.title != null) plan.title = String(updates.title).trim() || plan.title;
  if (updates.price != null) {
    const price = Number(updates.price);
    if (!Number.isFinite(price) || price < 0) {
      const err = new Error('Price must be a number of ₹ 0 or more');
      err.statusCode = 400;
      throw err;
    }
    plan.price = Math.round(price);
  }
  if (updates.durationDays != null) {
    const days = parseInt(updates.durationDays, 10);
    if (!Number.isFinite(days) || days < 1) {
      const err = new Error('Duration must be at least 1 day');
      err.statusCode = 400;
      throw err;
    }
    plan.durationDays = days;
  }
  if (updates.enabled != null) {
    const raw = updates.enabled;
    plan.enabled = raw === true || raw === 'true' || raw === 1 || raw === '1';
  }

  if (plan.enabled && Number(plan.price) < 1) {
    const err = new Error('Set a price of at least ₹1, or turn the plan off to keep this category free.');
    err.statusCode = 400;
    throw err;
  }

  await plan.save();
  return plan.toObject();
}

module.exports = {
  CATEGORIES,
  DEFAULT_PLANS,
  ensureDefaultPlans,
  listPlans,
  getPlan,
  isPaidCategory,
  updatePlan,
};
