export interface Webinar {
  id: string;
  title: string;
  date: string;
  time: string;
  zoomLink: string;
  zoomPassword?: string;
  registrationOpen: boolean;
  maxParticipants: number;
  description: string;
  price?: number;
  stripePriceId?: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  category: 'free' | 'premium';
  blobKey?: string;
  active: boolean;
  stripePriceId?: string;
  nextStart?: string;
  tags?: string[];
  imageUrl?: string;
  systemeioId?: string;
  systemeioUrl?: string;
}


export interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  status: 'active' | 'coming_soon' | 'closed';
  active: boolean;
  systemeioUrl?: string;
  systemeioId?: string;
  stripePriceId?: string;
  features: string[];
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  text: string;
  stars: number;
}

export interface Subscriber {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  tags: string[];
  createdAt: string;
}

export interface AdminSession {
  valid: boolean;
}

export interface NewsletterSubscribePayload {
  email: string;
  firstName?: string;
  lastName?: string;
  source?: string;
}

export interface WebinarRegisterPayload {
  email: string;
  fullName: string;
  webinarId: string;
}

export interface FreebieClaimPayload {
  email: string;
  productId: string;
  fullName?: string;
}

export interface CheckoutParams {
  priceId: string;
  productType: 'course' | 'subscription' | 'digital' | 'mentoring' | 'group-mentoring' | 'strategy';
  customerEmail?: string;
  metadata?: Record<string, string>;
}

export interface CalBookingPayload {
  triggerEvent: string;
  payload: {
    uid: string;
    attendees: Array<{ email: string; name: string }>;
    eventType: { title: string };
    startTime: string;
  };
}
