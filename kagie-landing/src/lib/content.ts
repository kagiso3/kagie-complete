import {
  GraduationCap, BookOpen, House, BusFront, Bell, BriefcaseBusiness,
  HandCoins, UserRound, FileText, Landmark, Send, ChartNoAxesCombined,
} from "lucide-react";

// Routes use the existing Kagie account and application system.
const appOrigin = (process.env.NEXT_PUBLIC_KAGIE_APP_URL ?? "").replace(/\/$/, "");
export const appLink = (route: string) => `${appOrigin}/${route}`;
export const routes = {
  open: appLink("login.html?app=1"),
  signup: appLink("signup.html?next=forms.html%3Fstep%3Dtype%26fresh%3D1"),
  institutions: appLink("login.html?app=1&next=prospectus.html"),
  courses: appLink("login.html?app=1&next=recommendation.html"),
  housing: appLink("login.html?app=1&next=more-service%2Faccommodation-assist.html"),
  transport: appLink("login.html?app=1&next=more-service%2Ftransport-assist.html"),
  updates: appLink("login.html?app=1&next=Dashboard.html"),
  career: appLink("login.html?app=1&next=career-guidance.html"),
  funding: appLink("login.html?app=1&next=more-service%2Ffunding-assist.html"),
};

export const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Universities", href: "#universities" },
  { label: "Courses", href: "#courses" },
  { label: "Accommodation", href: "#accommodation" },
  { label: "FAQ", href: "#faq" },
];

export const features = [
  { title: "Apply to Institutions", description: "Apply to multiple institutions from one dashboard.", icon: GraduationCap, color: "purple", href: routes.signup },
  { title: "Discover Courses", description: "Find courses that match your interests and APS score.", icon: BookOpen, color: "purple", href: routes.courses, id: "courses" },
  { title: "Find Accommodation", description: "Browse student housing and residence options.", icon: House, color: "red", href: routes.housing, id: "accommodation" },
  { title: "Student Transport", description: "Find transport information and routes.", icon: BusFront, color: "blue", href: routes.transport },
  { title: "Application Updates", description: "Get updates on your application status.", icon: Bell, color: "gold", href: routes.updates },
  { title: "Career Guidance", description: "Explore career paths and make informed choices.", icon: BriefcaseBusiness, color: "brown", href: routes.career },
  { title: "NSFAS Information", description: "Get information about funding and NSFAS.", icon: HandCoins, color: "red", href: routes.funding },
];

export const institutions = [
  { short: "TUT", name: "Tshwane University of Technology", logo: "tut.png", color: "#163e91", url: "https://www.tut.ac.za/" },
  { short: "DUT", name: "Durban University of Technology", logo: "dut.png", color: "#1c3431", url: "https://www.dut.ac.za/" },
  { short: "UJ", name: "University of Johannesburg", logo: "uj.png", color: "#e85c24", url: "https://www.uj.ac.za/" },
  { short: "UKZN", name: "University of KwaZulu-Natal", logo: "ukzn.png", color: "#222222", url: "https://ukzn.ac.za/" },
  { short: "UFS", name: "University of the Free State", logo: "ufs.png", color: "#14428b", url: "https://www.ufs.ac.za/" },
  { short: "VUT", name: "Vaal University of Technology", logo: null, color: "#173e91", url: "https://www.vut.ac.za/" },
  { short: "MUT", name: "Mangosuthu University of Technology", logo: null, color: "#7a2724", url: "https://www.mut.ac.za/" },
  { short: "CPUT", name: "Cape Peninsula University of Technology", logo: null, color: "#0c4b85", url: "https://www.cput.ac.za/" },
  { short: "UNISA", name: "University of South Africa", logo: "unisa.png", color: "#333333", url: "https://www.unisa.ac.za/" },
];

export const beforeItems = ["Multiple websites to navigate", "Different deadlines to track", "Lost application numbers", "Confusing requirements", "No central place to track progress"];
export const afterItems = ["One account for everything", "One dashboard to manage all applications", "One application journey", "Everything tracked in real-time", "Less stress, better future"];

export const steps = [
  { title: "Create Account", description: "Sign up in less than 2 minutes.", icon: UserRound },
  { title: "Complete Profile", description: "Add your details and academic info.", icon: FileText },
  { title: "Select Institutions", description: "Choose your preferred institutions and courses.", icon: Landmark },
  { title: "Submit Applications", description: "Submit and get your unique application numbers.", icon: Send },
  { title: "Track Progress", description: "Track your application status in real-time.", icon: ChartNoAxesCombined },
];

// Marketing figures and student stories supplied in the design brief.
// Replace with verified figures and approved testimonials before public publication.
export const stats = [
  { value: "20,000+", label: "Students Helped" },
  { value: "26+", label: "Institutions" },
  { value: "500+", label: "Courses" },
  { value: "24/7", label: "Support" },
];
export const testimonials = [
  { quote: "Kagie helped me apply to TUT and DUT without stress. Everything was in one place!", name: "Thabo M.", city: "Durban", portrait: 0 },
  { quote: "The course matching feature saved me so much time. I found the perfect course for my future.", name: "Lerato K.", city: "Johannesburg", portrait: 1 },
  { quote: "I tracked my application and got updates on time. Kagie is the real deal!", name: "Sipho D.", city: "Pietermaritzburg", portrait: 2 },
];

export const faqs = [
  { question: "What is Kagie?", answer: "Kagie brings institution discovery, course guidance, application support, documents, and progress tracking together. It helps South African students plan their next step after school." },
  { question: "Is it free to create a Kagie account?", answer: "Yes, you can create your account for free and explore the platform. Institution application fees and optional assistance services may have separate costs. You can review those costs before paying." },
  { question: "Can I apply to more than one institution?", answer: "Yes. Choose your preferred institutions and courses, complete your profile, and keep your application details together in your dashboard. Requirements and submission processes depend on the institution." },
  { question: "Does Kagie guarantee admission or NSFAS funding?", answer: "Admission decisions are made by each institution, and funding decisions are made by the relevant funding provider. Kagie helps you find information and manage the process; it does not guarantee admission or funding." },
  { question: "What do I need to get started?", answer: "Start with an email address and your personal details. You can then add your academic results and required documents to your profile. Each institution may request additional information." },
];
