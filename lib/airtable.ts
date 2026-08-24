import Airtable from 'airtable';
import type { Webinar, Product, Course, Subscriber, Testimonial } from '@/types';

function esc(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const TABLES = {
  subscribers: () => process.env.AIRTABLE_SUBSCRIBERS_TABLE || 'Feliratkozók',
  webinars: () => process.env.AIRTABLE_WEBINARS_TABLE || 'Webinár események',
  courseBuyers: () => process.env.AIRTABLE_COURSE_BUYERS_TABLE || 'Kurzus vásárlók',
  digitalBuyers: () => process.env.AIRTABLE_DIGITAL_BUYERS_TABLE || 'Digitális termék vásárlók',
  mentoringBuyers: () => process.env.AIRTABLE_MENTORING_BUYERS_TABLE || 'Mentorprogram vásárlók',
  products: () => process.env.AIRTABLE_PRODUCTS_TABLE || 'Termékek',
  testimonials: () => process.env.AIRTABLE_TESTIMONIALS_TABLE || 'Vélemények',
  courses: () => process.env.AIRTABLE_COURSES_TABLE || 'Kurzusok',
  settings: () => process.env.AIRTABLE_SETTINGS_TABLE || 'Beállítások',
};

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );
}

export async function getUpcomingWebinars(): Promise<Webinar[]> {
  const base = getBase();
  const now = new Date().toISOString().split('T')[0];
  const records = await base(TABLES.webinars())
    .select({
      filterByFormula: `AND({RegistrationOpen} = TRUE(), {Date} >= '${now}')`,
      sort: [{ field: 'Date', direction: 'asc' }],
      maxRecords: 3,
    })
    .all();

  return records.map((r) => ({
    id: r.id,
    title: String(r.fields['Title'] ?? ''),
    date: String(r.fields['Date'] ?? ''),
    time: String(r.fields['Time'] ?? ''),
    zoomLink: String(r.fields['ZoomLink'] ?? ''),
    zoomPassword: r.fields['ZoomPassword'] ? String(r.fields['ZoomPassword']) : undefined,
    registrationOpen: Boolean(r.fields['RegistrationOpen']),
    maxParticipants: Number(r.fields['MaxParticipants'] ?? 0),
    description: String(r.fields['Description'] ?? ''),
    price: r.fields['Price'] ? Number(r.fields['Price']) : undefined,
    stripePriceId: r.fields['StripePriceId'] ? String(r.fields['StripePriceId']) : undefined,
  }));
}

function mapProduct(r: { id: string; fields: Record<string, unknown> }): Product {
  return {
    id: r.id,
    title: String(r.fields['Title'] ?? ''),
    description: String(r.fields['Description'] ?? ''),
    price: Number(r.fields['Pricing'] ?? 0),
    category: (r.fields['Category'] as 'free' | 'premium') ?? 'premium',
    blobKey: r.fields['BlobKey'] ? String(r.fields['BlobKey']) : undefined,
    active: Boolean(r.fields['Active']),
    stripePriceId: r.fields['StripePriceId'] ? String(r.fields['StripePriceId']) : undefined,
    nextStart: r.fields['NextStart'] ? String(r.fields['NextStart']) : undefined,
    tags: r.fields['Tags'] ? String(r.fields['Tags']).split(',').map((t: string) => t.trim()).filter(Boolean) : undefined,
    imageUrl: r.fields['ImageUrl'] ? String(r.fields['ImageUrl']) : undefined,
    systemeioId: r.fields['SystemeioId'] ? String(r.fields['SystemeioId']) : undefined,
    systemeioUrl: r.fields['SystemeioUrl'] ? String(r.fields['SystemeioUrl']) : undefined,
  };
}

export async function getAllProductsAdmin(): Promise<Product[]> {
  const base = getBase();
  const records = await base(TABLES.products()).select().all();
  return records.map(mapProduct);
}

export async function getActiveProducts(): Promise<Product[]> {
  const base = getBase();
  const records = await base(TABLES.products())
    .select({ filterByFormula: '{Active} = TRUE()' })
    .all();
  return records.map(mapProduct);
}


export async function isWebinarRegistered(email: string, webinarId: string): Promise<boolean> {
  const base = getBase();
  const tag = `webinar_${webinarId}`;
  const records = await base(TABLES.subscribers())
    .select({
      filterByFormula: `AND({Email} = '${esc(email)}', FIND('${esc(tag)}', {Tags}))`,
      maxRecords: 1,
      fields: ['Email'],
    })
    .firstPage();
  return records.length > 0;
}

export async function addWebinarSubscriber(data: {
  email: string;
  firstName: string;
  webinarId: string;
}) {
  const base = getBase();
  const tag = `webinar_${data.webinarId}`;

  const existing = await base(TABLES.subscribers())
    .select({ filterByFormula: `{Email} = '${esc(data.email)}'`, maxRecords: 1 })
    .firstPage();

  if (existing.length > 0) {
    const currentTags = String(existing[0].fields['Tags'] || '');
    const newTags = currentTags.includes(tag)
      ? currentTags
      : [currentTags, tag].filter(Boolean).join(',');
    const updates: Record<string, string> = { Tags: newTags };
    if (data.firstName && !existing[0].fields['FirstName']) {
      updates.FirstName = data.firstName;
    }
    await base(TABLES.subscribers()).update(existing[0].id, updates);
  } else {
    await base(TABLES.subscribers()).create({
      Email: data.email,
      FirstName: data.firstName,
      Tags: tag,
      CreatedAt: new Date().toISOString(),
    });
  }
}

export async function addNewsletterSubscriber(email: string, source?: string, firstName?: string, lastName?: string) {
  const base = getBase();
  const existing = await base(TABLES.subscribers())
    .select({ filterByFormula: `{Email} = '${esc(email)}'`, maxRecords: 1 })
    .firstPage();

  if (existing.length > 0) {
    const updates: Record<string, string> = {};
    if (firstName && !existing[0].fields['FirstName']) updates.FirstName = firstName;
    if (lastName && !existing[0].fields['LastName']) updates.LastName = lastName;
    if (source) {
      const tags = String(existing[0].fields['Tags'] || '');
      const srcTag = `source_${source}`;
      if (!tags.includes(srcTag)) updates.Tags = [tags, srcTag].filter(Boolean).join(',');
    }
    if (Object.keys(updates).length > 0) {
      await base(TABLES.subscribers()).update(existing[0].id, updates);
    }
    return;
  }

  await base(TABLES.subscribers()).create({
    Email: email,
    FirstName: firstName || '',
    LastName: lastName || '',
    Tags: ['newsletter', source ? `source_${source}` : ''].filter(Boolean).join(','),
    CreatedAt: new Date().toISOString(),
  });
}

export async function updateSubscriberField(email: string, field: string, value: string) {
  const base = getBase();
  const existing = await base(TABLES.subscribers())
    .select({ filterByFormula: `{Email} = '${esc(email)}'`, maxRecords: 1 })
    .firstPage();
  if (existing.length === 0) return;
  await base(TABLES.subscribers()).update(existing[0].id, { [field]: value });
}

export async function airtableUnsubscribe(email: string) {
  const base = getBase();
  const existing = await base(TABLES.subscribers())
    .select({ filterByFormula: `{Email} = '${esc(email)}'`, maxRecords: 1 })
    .firstPage();
  if (existing.length === 0) return;
  await base(TABLES.subscribers()).update(existing[0].id, { Unsubscribed: true });
}

export async function addCoursePurchase(data: {
  email: string;
  courseId: string;
  stripeSessionId: string;
}) {
  const base = getBase();
  await base(TABLES.courseBuyers()).create({
    Email: data.email,
    CourseId: data.courseId,
    StripeSessionId: data.stripeSessionId,
    PurchasedAt: new Date().toISOString(),
  });
}

export async function addDigitalPurchase(data: {
  email: string;
  productId: string;
  stripeSessionId: string;
}) {
  const base = getBase();
  await base(TABLES.digitalBuyers()).create({
    Email: data.email,
    ProductId: data.productId,
    StripeSessionId: data.stripeSessionId,
    PurchasedAt: new Date().toISOString(),
  });
}

export async function addMentoringPurchase(data: {
  email: string;
  name?: string;
  program: 'privat' | 'kiscsoportos' | 'premium';
  stripeSessionId: string;
}) {
  const base = getBase();
  const programLabel =
    data.program === 'privat' ? 'Privát Havi Mentorprogram' :
    data.program === 'premium' ? 'Prémium Privát Havi Mentorprogram' :
    'Kiscsoportos Havi Mentorprogram';
  await base(TABLES.mentoringBuyers()).create({
    Email: data.email,
    Name: data.name || '',
    Program: programLabel,
    StripeSessionId: data.stripeSessionId,
    PurchasedAt: new Date().toISOString(),
  });
}

export async function getWebinarById(id: string): Promise<Webinar | null> {
  try {
    const base = getBase();
    const record = await base(TABLES.webinars()).find(id);
    return {
      id: record.id,
      title: String(record.fields['Title'] ?? ''),
      date: String(record.fields['Date'] ?? ''),
      time: String(record.fields['Time'] ?? ''),
      zoomLink: String(record.fields['ZoomLink'] ?? ''),
      zoomPassword: record.fields['ZoomPassword'] ? String(record.fields['ZoomPassword']) : undefined,
      registrationOpen: Boolean(record.fields['RegistrationOpen']),
      maxParticipants: Number(record.fields['MaxParticipants'] ?? 0),
      description: String(record.fields['Description'] ?? ''),
      price: record.fields['Price'] ? Number(record.fields['Price']) : undefined,
      stripePriceId: record.fields['StripePriceId'] ? String(record.fields['StripePriceId']) : undefined,
    };
  } catch {
    return null;
  }
}

export async function getWebinarRegistrationCount(webinarId: string): Promise<number> {
  const base = getBase();
  const tag = `webinar_${webinarId}`;
  const records = await base(TABLES.subscribers())
    .select({ filterByFormula: `FIND('${esc(tag)}', {Tags})`, fields: ['Email'] })
    .all();
  return records.length;
}

export async function getWebinarSubscribers(webinarId: string): Promise<Subscriber[]> {
  const base = getBase();
  const tag = `webinar_${webinarId}`;
  const records = await base(TABLES.subscribers())
    .select({ filterByFormula: `FIND('${esc(tag)}', {Tags})` })
    .all();

  return records.map((r) => ({
    id: r.id,
    email: String(r.fields['Email'] ?? ''),
    firstName: r.fields['FirstName'] ? String(r.fields['FirstName']) : undefined,
    tags: String(r.fields['Tags'] ?? '').split(',').filter(Boolean),
    createdAt: String(r.fields['CreatedAt'] ?? ''),
  }));
}

export async function getAllWebinars(): Promise<Webinar[]> {
  const base = getBase();
  const records = await base(TABLES.webinars())
    .select({ sort: [{ field: 'Date', direction: 'desc' }] })
    .all();

  return records.map((r) => ({
    id: r.id,
    title: String(r.fields['Title'] ?? ''),
    date: String(r.fields['Date'] ?? ''),
    time: String(r.fields['Time'] ?? ''),
    zoomLink: String(r.fields['ZoomLink'] ?? ''),
    zoomPassword: r.fields['ZoomPassword'] ? String(r.fields['ZoomPassword']) : undefined,
    registrationOpen: Boolean(r.fields['RegistrationOpen']),
    maxParticipants: Number(r.fields['MaxParticipants'] ?? 0),
    description: String(r.fields['Description'] ?? ''),
  }));
}

export async function createWebinar(data: Omit<Webinar, 'id'>): Promise<string> {
  const base = getBase();
  const record = await base(TABLES.webinars()).create({
    Title: data.title,
    Date: data.date,
    Time: data.time,
    ZoomLink: data.zoomLink,
    RegistrationOpen: data.registrationOpen,
    MaxParticipants: data.maxParticipants,
    Description: data.description,
  });
  return record.id;
}

export async function updateWebinar(id: string, data: Partial<Omit<Webinar, 'id'>>): Promise<void> {
  const base = getBase();
  const fields: Record<string, string | number | boolean | undefined> = {};
  if (data.title !== undefined) fields.Title = data.title;
  if (data.date !== undefined) fields.Date = data.date;
  if (data.time !== undefined) fields.Time = data.time;
  if (data.zoomLink !== undefined) fields.ZoomLink = data.zoomLink;
  if (data.registrationOpen !== undefined) fields.RegistrationOpen = data.registrationOpen;
  if (data.maxParticipants !== undefined) fields.MaxParticipants = data.maxParticipants;
  if (data.description !== undefined) fields.Description = data.description;
  await base(TABLES.webinars()).update(id, fields);
}

export async function deleteWebinar(id: string): Promise<void> {
  const base = getBase();
  await base(TABLES.webinars()).destroy(id);
}

function mapCourse(r: { id: string; fields: Record<string, unknown> }): Course {
  return {
    id: r.id,
    title: String(r.fields['Title'] ?? ''),
    description: String(r.fields['Description'] ?? ''),
    price: Number(r.fields['Price'] ?? 0),
    status: (r.fields['Status'] as Course['status']) ?? 'coming_soon',
    active: Boolean(r.fields['Active']),
    systemeioUrl: r.fields['SystemeioUrl'] ? String(r.fields['SystemeioUrl']) : undefined,
    systemeioId: r.fields['SystemeioId'] ? String(r.fields['SystemeioId']) : undefined,
    stripePriceId: r.fields['StripePriceId'] ? String(r.fields['StripePriceId']) : undefined,
    features: r.fields['Features']
      ? String(r.fields['Features']).split('\n').map(s => s.trim()).filter(Boolean)
      : [],
  };
}

export async function getCourseById(id: string): Promise<Course | null> {
  try {
    const base = getBase();
    const record = await base(TABLES.courses()).find(id);
    return mapCourse(record);
  } catch {
    return null;
  }
}

export async function getAllCoursesAdmin(): Promise<Course[]> {
  const base = getBase();
  const records = await base(TABLES.courses())
    .select({ sort: [{ field: 'Order', direction: 'asc' }] })
    .all();
  return records.map(mapCourse);
}

export async function getActiveCourses(): Promise<Course[]> {
  const base = getBase();
  const records = await base(TABLES.courses())
    .select({
      filterByFormula: '{Active} = TRUE()',
      sort: [{ field: 'Order', direction: 'asc' }],
    })
    .all();
  return records.map(mapCourse);
}

export async function createCourse(data: Omit<Course, 'id'>): Promise<string> {
  const base = getBase();
  const record = await base(TABLES.courses()).create({
    Title: data.title,
    Description: data.description,
    Price: data.price,
    Status: data.status,
    Active: data.active,
    Features: data.features.join('\n'),
    ...(data.systemeioUrl ? { SystemeioUrl: data.systemeioUrl } : {}),
    ...(data.stripePriceId ? { StripePriceId: data.stripePriceId } : {}),
  });
  return record.id;
}

export async function updateCourse(id: string, data: Partial<Omit<Course, 'id'>>): Promise<void> {
  const base = getBase();
  const fields: Record<string, string | number | boolean | undefined> = {};
  if (data.title !== undefined) fields.Title = data.title;
  if (data.description !== undefined) fields.Description = data.description;
  if (data.price !== undefined) fields.Price = data.price;
  if (data.status !== undefined) fields.Status = data.status;
  if (data.active !== undefined) fields.Active = data.active;
  if (data.features !== undefined) fields.Features = data.features.join('\n');
  if (data.systemeioUrl !== undefined) fields.SystemeioUrl = data.systemeioUrl;
  if (data.stripePriceId !== undefined) fields.StripePriceId = data.stripePriceId;
  await base(TABLES.courses()).update(id, fields);
}

export async function deleteCourse(id: string): Promise<void> {
  const base = getBase();
  await base(TABLES.courses()).destroy(id);
}

// ── Settings (key-value pairs) ──

export async function getSetting(key: string): Promise<string> {
  const base = getBase();
  const records = await base(TABLES.settings())
    .select({ filterByFormula: `{Key} = '${esc(key)}'`, maxRecords: 1 })
    .firstPage();
  return records.length > 0 ? String(records[0].fields['Value'] ?? '') : '';
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const base = getBase();
  const formula = `OR(${keys.map(k => `{Key} = '${esc(k)}'`).join(',')})`;
  const records = await base(TABLES.settings())
    .select({ filterByFormula: formula })
    .firstPage();
  const result: Record<string, string> = {};
  for (const k of keys) result[k] = '';
  for (const r of records) {
    const k = String(r.fields['Key'] ?? '');
    if (k) result[k] = String(r.fields['Value'] ?? '');
  }
  return result;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const base = getBase();
  const records = await base(TABLES.settings())
    .select({ filterByFormula: `{Key} = '${esc(key)}'`, maxRecords: 1 })
    .firstPage();
  if (records.length > 0) {
    await base(TABLES.settings()).update(records[0].id, { Value: value });
  } else {
    await base(TABLES.settings()).create({ Key: key, Value: value });
  }
}

export async function getTestimonials(): Promise<Testimonial[]> {
  const base = getBase();
  const records = await base(TABLES.testimonials())
    .select({
      filterByFormula: '{Active} = TRUE()',
      maxRecords: 20,
    })
    .all();

  return records.map((r) => ({
    id: r.id,
    name: String(r.fields['Name'] ?? ''),
    role: String(r.fields['Role'] ?? ''),
    text: String(r.fields['Text'] ?? ''),
    stars: Number(r.fields['Stars'] ?? 5),
  }));
}
