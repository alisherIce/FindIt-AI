import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BackendSession,
  createBackendItem,
  deleteItemPhoto,
  getBackendSession,
  isSupabaseConfigured,
  listBackendItems,
  publicItemPhotoUrl,
  resolveBackendItem,
  signInWithPassword,
  signOutFromBackend,
  signUpWithPassword,
  uploadItemPhoto
} from "./lib/supabase";
import {
  ArrowRight,
  ArrowUpRight,
  CarFront,
  PawPrint,
  Plane,
  Watch,
  BadgeCheck,
  BookOpen,
  Building2,
  Check,
  ChevronDown,
  Clock3,
  Compass,
  FileImage,
  Filter,
  Globe2,
  GraduationCap,
  Bus,
  CircleHelp,
  Laptop,
  LogOut,
  MapPin,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  UploadCloud,
  Wallet,
  X,
} from "lucide-react";

type ItemType = "lost" | "found";

type Item = {
  id: string;
  item_type: ItemType;
  title: string;
  category: string;
  campus: string;
  country?: string;
  location: string;
  description: string;
  image_filename: string;
  image_url?: string;
  status: string;
  owner_id: string | null;
  created_at: string;
};


type Match = Item & {
  matchScore: number;
  matchReasons: string[];
};
type CurrentUser = { id: string; email: string };

function fromBackendItem(row: import("./lib/supabase").BackendItem): Item {
  return {
    id: row.id,
    item_type: row.item_type,
    title: row.title,
    category: row.category,
    campus: row.campus,
    country: row.country,
    location: row.location,
    description: row.description,
    image_filename: row.image_path.split("/").pop() ?? "item-photo",
    image_url: publicItemPhotoUrl(row.image_path),
    status: row.status,
    owner_id: row.owner_id,
    created_at: row.created_at
  };
}

const hotspotCulture: Record<string, { country: string; image: string; alt: string; title: string; description: string; source: string; sourceLabel: string }> = {
  Seoul: {
    country: "South Korea",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Geunjeongjeon_Seoul.jpg?width=1000",
    alt: "Geunjeongjeon Hall at Gyeongbokgung Palace in Seoul",
    title: "Gyeongbokgung Palace heritage",
    description: "Explore the tiled roofs and wooden architecture of Bukchon and Seochon, where historic neighbourhoods sit beside the modern capital.",
    source: "https://commons.wikimedia.org/wiki/File:Geunjeongjeon_Seoul.jpg",
    sourceLabel: "kallerna · CC BY-SA 4.0"
  },
  Tokyo: {
    country: "Japan",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Tokyo_Tower_2023.jpg?width=1000",
    alt: "Tokyo Tower rising above the city",
    title: "Tokyo's cityscape and traditions",
    description: "Discover the lanterns, noren curtains and traditional shopfronts of Asakusa, a historic district in the heart of Tokyo.",
    source: "https://commons.wikimedia.org/wiki/File:Tokyo_Tower_2023.jpg",
    sourceLabel: "Akonnchiroll · CC BY-SA 4.0"
  },
  London: {
    country: "United Kingdom",
    image: "https://www.dslrphotographycourses.com/images/uploads/street-photography-course-London-21.jpg",
    alt: "Street scene in London's Brick Lane neighbourhood",
    title: "Brick Lane street culture",
    description: "A snapshot of East London's creative street life, layered with independent shops, public art and the neighbourhood's many cultural influences.",
    source: "https://www.dslrphotographycourses.com/photography-course-reviews/street-photography-course-london-30-08-2020",
    sourceLabel: "Photo source"
  },
  "New York": {
    country: "United States",
    image: "https://cdn.sanity.io/images/mkg24y51/production/249efb7fa8d66f838d2d6440f3fd1323c1005ddf-1000x666.webp/es-seguro-viajar-nueva-york-5.webp",
    alt: "Lower Manhattan street lined with historic brick buildings",
    title: "Lower Manhattan neighbourhoods",
    description: "Historic tenement buildings, busy sidewalks and dense city blocks reflect the everyday street life of New York.",
    source: "https://www.iatiseguros.com/blog/es-seguro-viajar-a-nueva-york/",
    sourceLabel: "Photo source"
  },
  Dubai: {
    country: "United Arab Emirates",
    image: "https://www.middleeastarchitect.com/cloud/2022/01/10/es8gr8Fy-Al-Fahidi-shutterstock_1906345519-1200x798.jpg",
    alt: "Traditional wind-tower buildings in Dubai's Al Fahidi historic neighbourhood",
    title: "Al Fahidi heritage quarter",
    description: "The historic lanes and barjeel wind towers of Al Fahidi show how traditional Emirati architecture responded to the desert climate.",
    source: "https://www.middleeastarchitect.com/insight/al-fahidi-rennovation-announced",
    sourceLabel: "Photo source"
  },
  Singapore: {
    country: "Singapore",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Singapore_Skyline_2019-10.jpg?width=1000",
    alt: "Colorful Peranakan heritage shophouses in Singapore",
    title: "Peranakan heritage streets",
    description: "Pastel shophouses, ornate tiles and decorative façades reflect the Peranakan architectural heritage found across Singapore.",
    source: "https://commons.wikimedia.org/wiki/File:Singapore_Skyline_2019-10.jpg",
    sourceLabel: "Unwicked · CC BY-SA 4.0"
  },
  Vancouver: {
    country: "Canada",
    image: "https://travel.destinationcanada.com/_next/image?q=75&url=https%3A%2F%2Fadmin.destinationcanada.com%2Fsites%2Fdefault%2Ffiles%2F2025-12%2Fimg_shizentai_select_vancouver.jpg&w=1920",
    alt: "Vancouver skyline beside the green forest of Stanley Park",
    title: "Pacific city and forest",
    description: "Vancouver's West Coast identity is shaped by the meeting of the Pacific waterfront, city neighbourhoods and the forests around Stanley Park.",
    source: "https://travel.destinationcanada.com/ja-jp/oku/shizentai",
    sourceLabel: "Destination Canada"
  },
  Sydney: {
    country: "Australia",
    image: "https://www.travelpress.com/wp-content/uploads/2023/10/Dreamtime-Experience-with-Aunty-Margret-Campbell-Sydney-Photo-Credit-Tourism-NSW_1024x768-1.jpg",
    alt: "Aboriginal cultural educator at Sydney Harbour",
    title: "First Nations culture at the harbour",
    description: "A glimpse of Aboriginal cultural connection in Sydney Harbour Country, alongside one of Australia's best-known waterfront landmarks.",
    source: "https://www.travelpress.com/aat-kings-program-highlights-australia-aboriginal-culture/",
    sourceLabel: "Photo credit: Tourism NSW"
  },
  Paris: {
    country: "France", image: "https://commons.wikimedia.org/wiki/Special:FilePath/Tour_Eiffel_Wikimedia_Commons_(cropped).jpg?width=1000",
    alt: "Eiffel Tower in Paris", title: "Parisian urban heritage",
    description: "Explore the city of boulevards, neighbourhood cafés, museums and the Eiffel Tower, a landmark from the 1889 World's Fair.",
    source: "https://commons.wikimedia.org/wiki/File:Tour_Eiffel_Wikimedia_Commons_(cropped).jpg", sourceLabel: "Benh LIEU SONG · Public domain"
  },
  Berlin: {
    country: "Germany", image: "https://commons.wikimedia.org/wiki/Special:FilePath/Brandenburger_Tor_abends.jpg?width=1000",
    alt: "Brandenburg Gate in Berlin at dusk", title: "Berlin's layered history",
    description: "The Brandenburg Gate stands at the heart of a city shaped by Prussian history, division, reunification and contemporary creative life.",
    source: "https://commons.wikimedia.org/wiki/File:Brandenburger_Tor_abends.jpg", sourceLabel: "Thomas Wolf · CC BY-SA 3.0"
  },
  Bangkok: {
    country: "Thailand", image: "https://commons.wikimedia.org/wiki/Special:FilePath/เจดีย์ประธานทรงปรางค์วัดอรุณ2.jpg?width=1000",
    alt: "Wat Arun temple in Bangkok", title: "Riverside temple traditions",
    description: "Wat Arun's decorated prang rises beside the Chao Phraya River, reflecting Thailand's Buddhist artistic and architectural heritage.",
    source: "https://commons.wikimedia.org/wiki/File:เจดีย์ประธานทรงปรางค์วัดอรุณ2.jpg", sourceLabel: "Mastertongapollo · CC BY-SA 4.0"
  },
  Beijing: {
    country: "China", image: "https://commons.wikimedia.org/wiki/Special:FilePath/Temple_of_Heaven_20160323_01.jpg?width=1000",
    alt: "Temple of Heaven in Beijing", title: "Imperial Beijing",
    description: "The Temple of Heaven's ceremonial architecture and landscaped grounds connect the city to centuries of Chinese imperial ritual and craftsmanship.",
    source: "https://commons.wikimedia.org/wiki/File:Temple_of_Heaven_20160323_01.jpg", sourceLabel: "Shujianyang · CC BY-SA 4.0"
  },
  "Buenos Aires": {
    country: "Argentina", image: "https://mintropolis.io/assets/cities/buenos-aires-v1.jpg",
    alt: "Obelisk of Buenos Aires at night", title: "Buenos Aires city life",
    description: "The Obelisk anchors a city known for tango, grand avenues, theatres, football culture and a strong café tradition.",
    source: "https://commons.wikimedia.org/wiki/File:Buenos_Aires_(20234294752).jpg", sourceLabel: "Rodrigo Paredes · CC BY 2.0"
  },
  Cairo: {
    country: "Egypt", image: "https://commons.wikimedia.org/wiki/Special:FilePath/Cairo_Tower_(14795997855).jpg?width=1000",
    alt: "Cairo Tower above the city", title: "Cairo across eras",
    description: "Cairo brings together historic Islamic architecture, lively markets, contemporary neighbourhoods and landmarks along the Nile.",
    source: "https://commons.wikimedia.org/wiki/File:Cairo_Tower_(14795997855).jpg", sourceLabel: "Jorge Láscar · CC BY 2.0"
  },
  "Cape Town": {
    country: "South Africa", image: "https://commons.wikimedia.org/wiki/Special:FilePath/Table_Mountain_DanieVDM.jpg?width=1000",
    alt: "Table Mountain overlooking Cape Town", title: "Cape Town's natural landmark",
    description: "Table Mountain frames a city shaped by diverse communities, coastal landscapes, layered histories and a vibrant arts and food scene.",
    source: "https://commons.wikimedia.org/wiki/File:Table_Mountain_DanieVDM.jpg", sourceLabel: "Danie van der Merwe · CC BY 2.0"
  },
  Istanbul: {
    country: "Türkiye", image: "https://commons.wikimedia.org/wiki/Special:FilePath/Hagia_Sophia_(228968325).jpeg?width=1000",
    alt: "Hagia Sophia in Istanbul", title: "A city between continents",
    description: "Hagia Sophia reflects Istanbul's Byzantine and Ottoman histories, while the city's markets, ferries and neighbourhoods connect Europe and Asia.",
    source: "https://commons.wikimedia.org/wiki/File:Hagia_Sophia_(228968325).jpeg", sourceLabel: "Adli Wahid · CC BY-SA 3.0"
  },
  Lisbon: {
    country: "Portugal", image: "https://commons.wikimedia.org/wiki/Special:FilePath/Belém_Tower_in_Lisbon,_Portugal.jpg?width=1000",
    alt: "Belém Tower in Lisbon", title: "Lisbon's maritime heritage",
    description: "Belém Tower recalls Portugal's seafaring history; tiled façades, hilltop streets and fado music are part of the city's living identity.",
    source: "https://commons.wikimedia.org/wiki/File:Bel%C3%A9m_Tower_in_Lisbon,_Portugal.jpg", sourceLabel: "Lisbon Photoshoots · CC BY-SA 4.0"
  },
  Melbourne: {
    country: "Australia", image: "https://commons.wikimedia.org/wiki/Special:FilePath/Flinders_Station_and_trams.jpg?width=1000",
    alt: "Flinders Street Station and trams in Melbourne", title: "Melbourne's laneways and trams",
    description: "The city's tram network, historic Flinders Street Station, laneway art and café culture shape everyday Melbourne life.",
    source: "https://commons.wikimedia.org/wiki/File:Flinders_Station_and_trams.jpg", sourceLabel: "Philip Mallis · CC BY-SA 3.0"
  },
  "Mexico City": {
    country: "Mexico", image: "https://commons.wikimedia.org/wiki/Special:FilePath/Bellas_Artes_01.jpg?width=1000",
    alt: "Palacio de Bellas Artes in Mexico City", title: "Art and tradition in Mexico City",
    description: "Palacio de Bellas Artes is a landmark for Mexican music, dance, visual arts and the city's rich architectural story.",
    source: "https://commons.wikimedia.org/wiki/File:Bellas_Artes_01.jpg", sourceLabel: "Xavier Quetzalcoatl Contreras Castillo · CC BY-SA 3.0"
  },
  Mumbai: {
    country: "India", image: "https://commons.wikimedia.org/wiki/Special:FilePath/Gateway_Of_India.JPG?width=1000",
    alt: "Gateway of India in Mumbai", title: "Mumbai's harbour city",
    description: "The Gateway of India looks over Mumbai's waterfront, a city known for many languages, film, festivals, markets and diverse food traditions.",
    source: "https://commons.wikimedia.org/wiki/File:Gateway_Of_India.JPG", sourceLabel: "Sujit Kumar · CC BY-SA 4.0"
  },
  Nairobi: {
    country: "Kenya", image: "https://commons.wikimedia.org/wiki/Special:FilePath/KICC_nairobi_kenya.jpg?width=1000",
    alt: "Kenyatta International Convention Centre in Nairobi", title: "Nairobi's urban rhythm",
    description: "Nairobi is a major East African hub where contemporary city life, creative communities and the region's varied cultural traditions meet.",
    source: "https://commons.wikimedia.org/wiki/File:KICC_nairobi_kenya.jpg", sourceLabel: "Original uploader Mkimemia · CC BY-SA 3.0"
  },
  "São Paulo": {
    country: "Brazil", image: "https://commons.wikimedia.org/wiki/Special:FilePath/Catedral_da_Sé_em_São_Paulo.jpg?width=1000",
    alt: "São Paulo Cathedral at Praça da Sé", title: "São Paulo's cultural mosaic",
    description: "The city centre reflects São Paulo's many communities, with architecture, music, food and neighbourhood traditions from around the world.",
    source: "https://commons.wikimedia.org/wiki/File:Catedral_da_S%C3%A9_em_S%C3%A3o_Paulo.jpg", sourceLabel: "Wilfredor · CC0"
  },
  Taipei: {
    country: "Taiwan", image: "https://commons.wikimedia.org/wiki/Special:FilePath/Taipei_101_in_2019.jpg?width=1000",
    alt: "Taipei 101 tower in Taiwan", title: "Taipei's old and new",
    description: "Taipei pairs contemporary landmarks with night markets, temples, tea culture and lively neighbourhood streets.",
    source: "https://commons.wikimedia.org/wiki/File:Taipei_101_in_2019.jpg", sourceLabel: "James Tang · CC BY-SA 4.0"
  },
  Toronto: {
    country: "Canada", image: "https://commons.wikimedia.org/wiki/Special:FilePath/CN_Tower.jpg?width=1000",
    alt: "CN Tower in Toronto", title: "Toronto's neighbourhood cultures",
    description: "Toronto's skyline sits above neighbourhoods shaped by Indigenous histories and generations of migration, languages, food and arts.",
    source: "https://commons.wikimedia.org/wiki/File:CN_Tower.jpg", sourceLabel: "Local hero · Public domain"
  },
  Oslo: {
    country: "Norway", image: "https://commons.wikimedia.org/wiki/Special:FilePath/The_Oslo_Opera_House_(Operahuset)_(29253178463).jpg?width=1000",
    alt: "Oslo Opera House beside the Oslofjord", title: "Oslo's fjord and opera house",
    description: "The waterfront Opera House is a modern cultural landmark where visitors can walk across the roof and look out over the Oslofjord.",
    source: "https://commons.wikimedia.org/wiki/File:The_Oslo_Opera_House_(Operahuset)_(29253178463).jpg", sourceLabel: "Jorge Láscar · CC BY 2.0"
  },
  Marrakech: {
    country: "Morocco", image: "https://commons.wikimedia.org/wiki/Special:FilePath/Fnar_and_Atlas_mountains.jpg?width=1000",
    alt: "Jemaa el-Fnaa square with the Atlas Mountains beyond Marrakech", title: "Marrakech's living medina",
    description: "Jemaa el-Fnaa is a historic public square known for food stalls, storytellers, crafts and the daily life of the medina.",
    source: "https://commons.wikimedia.org/wiki/File:Fnar_and_Atlas_mountains.jpg", sourceLabel: "Elgaard · CC BY-SA 4.0"
  },
};

const categoryIcons: Record<string, typeof Package> = {
  electronics: Laptop,
  accessories: Wallet,
  documents: FileImage,
  books: BookOpen,
};

function iconForCategory(category: string) {
  const key = category.toLowerCase();
  const match = Object.entries(categoryIcons).find(([name]) => key.includes(name));
  return match?.[1] ?? Package;
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("Could not read the selected image."));
    };

    reader.onload = () => {
      const image = new Image();

      image.onerror = () => {
        reject(new Error("The selected image is invalid."));
      };

      image.onload = () => {
        const maxDimension = 900;

        const scale = Math.min(
          1,
          maxDimension / Math.max(image.width, image.height)
        );

        const canvas = document.createElement("canvas");

        canvas.width = Math.max(
          1,
          Math.round(image.width * scale)
        );

        canvas.height = Math.max(
          1,
          Math.round(image.height * scale)
        );

        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Image compression is unavailable."));
          return;
        }

        context.drawImage(
          image,
          0,
          0,
          canvas.width,
          canvas.height
        );

        resolve(canvas.toDataURL("image/jpeg", 0.66));
      };

      image.src = String(reader.result);
    };

    reader.readAsDataURL(file);
  });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

type DemoUser = CurrentUser;

const DEMO_ITEMS_KEY = "findit_demo_items";
const DEMO_USERS_KEY = "findit_demo_users";
const DEMO_SESSION_KEY = "findit_demo_session";

function createDemoItems(): Item[] {
  const now = Date.now();
  const samples: Array<Pick<Item, "item_type" | "title" | "category" | "campus" | "location" | "description" | "image_url">> = [
    { item_type: "found", title: "Black leather wallet", category: "Personal items", campus: "Gachon University", location: "Central Library, 1st floor", description: "Found near the study tables. Owner can identify the card holder inside.", image_url: "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=900&q=85" },
    { item_type: "found", title: "Silver wireless earbuds case", category: "Electronics", campus: "Gachon University", location: "Engineering Building", description: "Small silver charging case handed in after class.", image_url: "https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=900&q=85" },
    { item_type: "lost", title: "Blue student umbrella", category: "Personal items", campus: "Gachon University", location: "Global Campus bus stop", description: "Foldable blue umbrella with a black wrist strap.", image_url: "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?auto=format&fit=crop&w=900&q=85" },
    { item_type: "found", title: "Student ID card holder", category: "Documents", campus: "Gachon University", location: "Student Union, ground floor", description: "Clear card holder found beside the cafeteria.", image_url: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=900&q=85" },
    { item_type: "lost", title: "Black laptop sleeve", category: "Electronics", campus: "Gachon University", location: "IT Building, room 204", description: "13-inch black laptop sleeve with a small fabric label.", image_url: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=85" },
    { item_type: "found", title: "Silver key ring", category: "Keys", campus: "Gachon University", location: "Main Gate", description: "Two keys on a plain silver ring.", image_url: "https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=900&q=85" }
  ];
  return samples.map((sample, index) => ({
    ...sample,
    id: `demo-${index + 1}`,
    image_filename: "",
    image_url: sample.image_url,
    status: "active",
    owner_id: null,
    created_at: new Date(now - index * 86400000).toISOString()
  }));
}

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [token, setToken] = useState(() => localStorage.getItem(DEMO_SESSION_KEY) ?? "");
  const [backendSession, setBackendSession] = useState<BackendSession | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [form, setForm] = useState({ title: "", category: "Electronics", campus: "Gachon University", location: "", description: "" });
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [pendingReportType, setPendingReportType] = useState<ItemType | null>(null);
  const [filter, setFilter] = useState<"all" | ItemType>("found");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState<ItemType>("lost");
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [matchesFor, setMatchesFor] = useState<Item | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [notice, setNotice] = useState("");
  const [country, setCountry] = useState("South Korea");
  const [showResultsFilters, setShowResultsFilters] = useState(false);
  const [pickedDate, setPickedDate] = useState("");
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const [networkCategory, setNetworkCategory] = useState("All");
  const [activeHotspot, setActiveHotspot] = useState("Seoul");
  const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1600&q=75",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1600&q=75",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1600&q=75",
  "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=1600&q=75"
];


  async function loadItems() {
    setLoading(true);
    try {
      if (isSupabaseConfigured) {
        const rows = await listBackendItems();
        setItems(rows.map(fromBackendItem));
      } else {
        const stored = localStorage.getItem(DEMO_ITEMS_KEY);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (!Array.isArray(parsed)) throw new Error("Saved reports have an unsupported format.");
          setItems(parsed as Item[]);
        } else {
          const samples = createDemoItems();
          localStorage.setItem(DEMO_ITEMS_KEY, JSON.stringify(samples));
          setItems(samples);
        }
      }
    } catch (err) {
      if (isSupabaseConfigured) {
        setItems([]);
        setError(err instanceof Error ? err.message : "Could not load shared reports.");
      } else {
        setItems(createDemoItems());
        setError("Saved browser data could not be read. Showing sample reports instead.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      if (isSupabaseConfigured) {
        let restored: BackendSession | null = null;
        try {
          restored = await getBackendSession();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not restore your Supabase session.");
        }
        if (!active) return;
        setBackendSession(restored);
        setToken(restored?.access_token ?? "");
        setCurrentUser(restored ? { id: restored.user.id, email: restored.user.email ?? "" } : null);
        await loadItems();
        return;
      }

      loadItems();
      try {
        const sessionId = localStorage.getItem(DEMO_SESSION_KEY);
        const storedUsers: unknown = JSON.parse(localStorage.getItem(DEMO_USERS_KEY) ?? "[]");
        const users = Array.isArray(storedUsers) ? storedUsers as DemoUser[] : [];
        const user = users.find((entry) => entry.id === sessionId);
        if (user) setCurrentUser({ id: user.id, email: user.email });
        else {
          localStorage.removeItem(DEMO_SESSION_KEY);
          setToken("");
        }
      } catch {
        localStorage.removeItem(DEMO_SESSION_KEY);
        setToken("");
        setCurrentUser(null);
      }
    };
    void initialize();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === DEMO_ITEMS_KEY && !isSupabaseConfigured) void loadItems();
      if (event.key === "findit_supabase_session" && isSupabaseConfigured) {
        void getBackendSession().then((restored) => {
          setBackendSession(restored);
          setToken(restored?.access_token ?? "");
          setCurrentUser(restored ? { id: restored.user.id, email: restored.user.email ?? "" } : null);
        });
      }
      if (event.key === DEMO_SESSION_KEY && !isSupabaseConfigured) {
        const sessionId = event.newValue;
        try {
          const users: DemoUser[] = JSON.parse(localStorage.getItem(DEMO_USERS_KEY) ?? "[]");
          const user = users.find((entry) => entry.id === sessionId);
          setCurrentUser(user ? { id: user.id, email: user.email } : null);
          setToken(sessionId ?? "");
        } catch {
          setCurrentUser(null);
          setToken("");
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      active = false;
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;
    const intervalId = window.setInterval(() => {
      setHeroImageIndex((current) => (current + 1) % HERO_IMAGES.length);
    }, 6500);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  
const activeItems = useMemo(
  () => items.filter((item) => item.status === "active"),
  [items]
);

const filteredItems = useMemo(() => {
  const term = search.trim().toLowerCase();

  return activeItems.filter((item) => {
    const typeMatches =
      filter === "all" || item.item_type === filter;

    const countryMatches =
      country === "All countries" ||
      (item.country ?? "South Korea") === country;

    const itemTime = Date.parse(item.created_at);

    const dateMatches =
      !pickedDate ||
      (
        Number.isFinite(itemTime) &&
        (() => {
          const localDate = new Date(itemTime);
          const year = localDate.getFullYear();
          const month = String(localDate.getMonth() + 1).padStart(2, "0");
          const day = String(localDate.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}` === pickedDate;
        })()
      );

    const textMatches =
      !term ||
      [
        item.title,
        item.category,
        item.campus,
        item.location,
        item.description
      ].some((value) =>
        value.toLowerCase().includes(term)
      );

    return (
      typeMatches &&
      countryMatches &&
      dateMatches &&
      textMatches
    );
  });
}, [activeItems, filter, country, search, pickedDate]);

const lostCount = activeItems.filter(
  (item) => item.item_type === "lost"
).length;

const foundCount = activeItems.filter(
  (item) => item.item_type === "found"
).length;


  function updateForm(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startReport(type: ItemType) {
    setReportType(type);
    setForm({
      title: "",
      category: "Electronics",
      campus: "Gachon University",
      location: "",
      description: "",
    });
    setSelectedFile(null);
    setShowReport(true);
  }

  function openReport(type: ItemType) {
    if (!currentUser) {
      setPendingReportType(type);
      setAuthError("");
      setAuthMode("login");
      setShowAuth(true);
      return;
    }
    startReport(type);
  }

  
async function submitAuth(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setAuthBusy(true);
  setAuthError("");

  try {
    const email = authEmail.trim().toLowerCase();
    if (!email) throw new Error("Please enter your email.");

    if (isSupabaseConfigured) {
      if (authPassword.length < 8) throw new Error("Use a password with at least 8 characters.");
      if (authMode === "register") {
        const session = await signUpWithPassword(email, authPassword);
        if (!session) {
          setShowAuth(false);
          setAuthPassword("");
          setAuthEmail("");
          setNotice("Account created. Check your email to confirm the address, then sign in.");
          return;
        }
        setBackendSession(session);
        setToken(session.access_token);
        setCurrentUser({ id: session.user.id, email: session.user.email ?? email });
        setNotice("Your account is ready. Your reports will be shared with the community.");
      } else {
        const session = await signInWithPassword(email, authPassword);
        setBackendSession(session);
        setToken(session.access_token);
        setCurrentUser({ id: session.user.id, email: session.user.email ?? email });
        setNotice("You are signed in to FindIt AI.");
      }
    } else {
      const users: DemoUser[] = JSON.parse(localStorage.getItem(DEMO_USERS_KEY) ?? "[]");
      let user = users.find((entry) => entry.email.toLowerCase() === email);
      if (authMode === "register") {
        if (user) throw new Error("A demo profile with this email already exists.");
        user = { id: crypto.randomUUID(), email };
        users.push(user);
      } else if (!user) {
        throw new Error("No local profile exists. Create a demo profile first.");
      }
      localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
      localStorage.setItem(DEMO_SESSION_KEY, user.id);
      setToken(user.id);
      setCurrentUser({ id: user.id, email: user.email });
      setNotice(authMode === "register"
        ? "Local demo profile created. Connect Supabase to enable shared accounts and reports."
        : "Your local demo profile has been restored.");
    }

    setShowAuth(false);
    setAuthMode("login");
    setAuthPassword("");
    if (pendingReportType) {
      startReport(pendingReportType);
      setPendingReportType(null);
    }
  } catch (err) {
    setAuthError(err instanceof Error ? err.message : "Could not access your account.");
  } finally {
    setAuthBusy(false);
  }
}

  async function signOut() {
    try {
      if (isSupabaseConfigured) {
        await signOutFromBackend();
        setBackendSession(null);
      } else {
        localStorage.removeItem(DEMO_SESSION_KEY);
      }
      setToken("");
      setCurrentUser(null);
      setNotice("You have signed out.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign out.");
    }
  }

  
async function submitReport(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (!selectedFile) {
    setError("Please choose a photo of the item.");
    return;
  }
  if (!currentUser) {
    setError("Sign in before submitting a report.");
    return;
  }

  setSubmitting(true);
  setError("");
  let uploadedPath: string | null = null;

  try {
    const compressedImage = await compressImage(selectedFile);
    const nextCountry = country === "All countries" ? "South Korea" : country;

    if (isSupabaseConfigured) {
      if (!backendSession) throw new Error("Your session expired. Please sign in again.");
      const imageBlob = await fetch(compressedImage).then((response) => response.blob());
      uploadedPath = await uploadItemPhoto(imageBlob, currentUser.id, selectedFile.name, backendSession.access_token);
      const saved = await createBackendItem({
        item_type: reportType,
        title: form.title.trim(),
        category: form.category,
        campus: form.campus.trim(),
        country: nextCountry,
        location: form.location.trim(),
        description: form.description.trim(),
        image_path: uploadedPath,
        owner_id: currentUser.id
      }, backendSession.access_token);
      setItems((current) => [fromBackendItem(saved), ...current]);
      setNotice("Your report is now published to the shared FindIt AI community.");
    } else {
      const nextItem: Item = {
        id: crypto.randomUUID(),
        item_type: reportType,
        title: form.title.trim(),
        category: form.category,
        campus: form.campus.trim(),
        country: nextCountry,
        location: form.location.trim(),
        description: form.description.trim(),
        image_filename: selectedFile.name,
        image_url: compressedImage,
        status: "active",
        owner_id: currentUser.id,
        created_at: new Date().toISOString()
      };
      const nextItems = [nextItem, ...items];
      localStorage.setItem(DEMO_ITEMS_KEY, JSON.stringify(nextItems));
      setItems(nextItems);
      setNotice("Demo report saved in this browser. Add Supabase settings to publish it for everyone.");
    }

    setShowReport(false);
    setSelectedFile(null);
    setForm({ title: "", category: "Electronics", campus: "Gachon University", location: "", description: "" });
    void loadItems();
  } catch (err) {
    if (uploadedPath && backendSession) {
      try { await deleteItemPhoto(uploadedPath, backendSession.access_token); } catch { /* The orphan can be removed from Supabase Storage later. */ }
    }
    setError(err instanceof Error ? err.message : "Could not save your report.");
  } finally {
    setSubmitting(false);
  }
}

  function showMatches(item: Item) {
    const oppositeType: ItemType = item.item_type === "lost" ? "found" : "lost";
    const sourceText = `${item.title} ${item.description} ${item.location}`.toLowerCase();
    const sourceWords = new Set(sourceText.split(/[^a-z0-9]+/).filter((word) => word.length > 2));
    const ranked: Match[] = activeItems
      .filter((candidate) => candidate.id !== item.id && candidate.item_type === oppositeType)
      .map((candidate) => {
        const candidateText = `${candidate.title} ${candidate.description} ${candidate.location}`.toLowerCase();
        const candidateWords = candidateText.split(/[^a-z0-9]+/).filter((word) => word.length > 2);
        const sharedWords = candidateWords.filter((word) => sourceWords.has(word));
        const reasons: string[] = [];
        let score = 0;
        if (candidate.category.toLowerCase() === item.category.toLowerCase()) {
          score += 25;
          reasons.push("Same category");
        }
        if (sharedWords.length) {
          score += Math.min(45, sharedWords.length * 15);
          reasons.push("Similar item description");
        }
        if (candidate.campus.toLowerCase() === item.campus.toLowerCase()) {
          score += 20;
          reasons.push("Same campus");
        }
        const sourceLocation = item.location.toLowerCase();
        const candidateLocation = candidate.location.toLowerCase();
        if (sourceLocation === candidateLocation || sourceLocation.includes(candidateLocation) || candidateLocation.includes(sourceLocation)) {
          score += 10;
          reasons.push("Similar location");
        }
        if (item.country && candidate.country && item.country === candidate.country) {
          score += 5;
          reasons.push("Same country");
        }
        return { ...candidate, matchScore: Math.min(100, score), matchReasons: reasons };
      })
      .filter((candidate) => candidate.matchScore >= 25)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);
    setMatches(ranked);
    setMatchesFor(item);
  }

  async function resolveItem(item: Item) {
    if (item.owner_id !== currentUser?.id) return;
    try {
      if (isSupabaseConfigured) {
        if (!backendSession) throw new Error("Please sign in again.");
        await resolveBackendItem(item.id, currentUser.id, backendSession.access_token);
        setItems((current) => current.filter((entry) => entry.id !== item.id));
      } else {
        const nextItems = items.map((entry) => entry.id === item.id ? { ...entry, status: "resolved" } : entry);
        localStorage.setItem(DEMO_ITEMS_KEY, JSON.stringify(nextItems));
        setItems(nextItems);
      }
      setNotice("Your report was marked as resolved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve this report.");
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar is-visible">
        <a className="brand" href="#discover" aria-label="FindIt AI home">
          <span className="brand-mark"><MapPin size={22} fill="currentColor" strokeWidth={2.5} /></span>
          <span className="brand-word">FindIt <span className="brand-ai">AI</span></span>
        </a>
        <nav className="top-nav" aria-label="Main navigation">
          <a className="nav-active" href="#discover">Search items</a>
          <a href="#how-it-works">How it works</a>
          <a href="#organizations">For organizations</a>
        </nav>
        <div className="topbar-right">
          <button className="country-nav" type="button" onClick={() => document.getElementById("country-select")?.focus()}><Globe2 size={17} /> Countries <ChevronDown size={14} /></button>
          <button className="help-nav" type="button" onClick={() => document.getElementById("faq-title")?.scrollIntoView({ behavior: "smooth" })}><CircleHelp size={18} /> Help</button>
          {currentUser ? (
            <div className="account-actions">
              <span className="account-email">{currentUser.email}</span>
              <button className="icon-button signout-button" onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
            </div>
          ) : (
            <button className="button button-outline button-small" onClick={() => { setAuthError(""); setAuthMode("login"); setShowAuth(true); }}>Sign in</button>
          )}
          <button className="button button-dark button-small" onClick={() => openReport("lost")}>
            <Plus size={16} /> Report an item
          </button>
        </div>
      </header>

      <main>
        <section className="hero" id="discover">
          <img key={heroImageIndex} className="hero-photo" src={HERO_IMAGES[heroImageIndex]} alt="" aria-hidden="true" />
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles size={14} /> SMART CAMPUS LOST & FOUND</div>
            <h1>Lost something?<br /><span>Let’s bring it back.</span></h1>
            <p className="hero-description">
              Search community reports and compare possible matches in this interactive browser demo.
            </p>
            <div className="hero-search">
              <label className="hero-country"><Globe2 size={18} /><select id="country-select" value={country} onChange={(event) => setCountry(event.target.value)} aria-label="Choose country"><option value="South Korea">🇰🇷  South Korea</option><option value="United States">🇺🇸  United States</option><option value="United Kingdom">🇬🇧  United Kingdom</option><option value="Uzbekistan">🇺🇿  Uzbekistan</option><option value="Japan">🇯🇵  Japan</option><option value="Canada">🇨🇦  Canada</option><option value="Australia">🇦🇺  Australia</option><option value="Germany">🇩🇪  Germany</option><option value="France">🇫🇷  France</option><option value="Italy">🇮🇹  Italy</option><option value="Spain">🇪🇸  Spain</option><option value="Netherlands">🇳🇱  Netherlands</option><option value="Switzerland">🇨🇭  Switzerland</option><option value="Sweden">🇸🇪  Sweden</option><option value="Norway">🇳🇴  Norway</option><option value="Singapore">🇸🇬  Singapore</option><option value="Malaysia">🇲🇾  Malaysia</option><option value="Türkiye">🇹🇷  Türkiye</option><option value="United Arab Emirates">🇦🇪  United Arab Emirates</option><option value="India">🇮🇳  India</option><option value="China">🇨🇳  China</option><option value="Brazil">🇧🇷  Brazil</option><option value="Mexico">🇲🇽  Mexico</option><option value="New Zealand">🇳🇿  New Zealand</option><option value="All countries">🌐  All countries</option></select><ChevronDown size={14} /></label>
              <label className="hero-query"><Search size={19} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") { setFilter("found"); setShowResultsFilters(true); document.getElementById("community-board")?.scrollIntoView({ behavior: "smooth" }); } }}
                placeholder="What have you lost? Try wallet, keys, phone..."
                aria-label="Search lost and found items"
              /></label>
              <button className="hero-search-submit" type="button" aria-label="Search" onClick={() => { setFilter("found"); setShowResultsFilters(true); document.getElementById("community-board")?.scrollIntoView({ behavior: "smooth" }); }}><Search size={21} /></button>
            </div>
            <div className="hero-actions hero-search-prompt">
              <span><Search size={15} /> Search found-item reports first</span>
              <button className="button button-primary" type="button" onClick={() => { setFilter("found"); setShowResultsFilters(true); document.getElementById("community-board")?.scrollIntoView({ behavior: "smooth" }); }}>
                Find my item <ArrowUpRight size={17} />
              </button>
            </div>
            <div className="hero-quick-links">
              <span>Popular searches</span>
              {["Wallet", "Phone", "Keys", "Student ID"].map((term) => (
                <button key={term} onClick={() => { setSearch(term); setFilter("found"); setShowResultsFilters(true); document.getElementById("community-board")?.scrollIntoView({ behavior: "smooth" }); }}>{term}</button>
              ))}
            </div>
            <div className="trust-line"><ShieldCheck size={16} /> {isSupabaseConfigured ? "Shared community reports are enabled." : "Demo reports stay in this browser. Cloud sharing is not configured yet."}</div>
          </div>
          <div className="hero-art" aria-label="Illustration of a found item being returned">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-spark spark-a">✳</div>
            <div className="art-spark spark-b">✦</div>
            <div className="art-card art-card-back"><span className="mini-label">FOUND NEAR</span><strong>Library</strong><MapPin size={17} /></div>
            <div className="art-card art-card-front">
              <div className="art-wallet"><Wallet size={54} strokeWidth={1.25} /></div>
              <span className="art-pill"><span /> MATCH FOUND</span>
              <strong>One step closer.</strong>
              <small>Good things find their way home.</small>
            </div>
            <div className="art-float"><BadgeCheck size={20} /><span>Smart item<br />matching</span></div>
          </div>
        </section>

        <section className="partners-section" aria-label="FindIt AI partner organizations">
          <h2 className="partner-intro">Designed for campus and community organizations</h2>
          <p className="partners-subtitle">Potential places where a shared lost-and-found service could connect people</p>
          <div className="partners-marquee">
            <div className="partners-track">
              <div className="partners-group">
                <span className="partner-logo partner-gachon"><span className="partner-symbol">C</span> CAMPUS COMMUNITIES</span>
                <span className="partner-logo"><Building2 size={24}/> CAMPUS LIFE</span>
                <span className="partner-logo"><GraduationCap size={25}/> STUDENT SERVICES</span>
                <span className="partner-logo"><BookOpen size={24}/> UNIVERSITY LIBRARY</span>
                <span className="partner-logo"><Bus size={25}/> CAMPUS TRANSIT</span>
                <span className="partner-logo"><ShieldCheck size={24}/> CAMPUS SECURITY</span>
              </div>
              <div className="partners-group" aria-hidden="true">
                <span className="partner-logo partner-gachon"><span className="partner-symbol">C</span> CAMPUS COMMUNITIES</span>
                <span className="partner-logo"><Building2 size={24}/> CAMPUS LIFE</span>
                <span className="partner-logo"><GraduationCap size={25}/> STUDENT SERVICES</span>
                <span className="partner-logo"><BookOpen size={24}/> UNIVERSITY LIBRARY</span>
                <span className="partner-logo"><Bus size={25}/> CAMPUS TRANSIT</span>
                <span className="partner-logo"><ShieldCheck size={24}/> CAMPUS SECURITY</span>
              </div>
            </div>
          </div>
        </section>

        <section className="proof-band" aria-label="FindIt AI product value">
          <div className="proof-copy">
            <div className="eyebrow">A CLEARER WAY TO SEARCH</div>
            <h2>Small things. Big relief.</h2>
            <p>Browse reports and compare details to find possible leads in your community.</p>
          </div>
          <div className="proof-points review-quote">
            <strong>Search first. Compare carefully. Arrange a safe handover.</strong>
            <span>FindIt AI product principles</span>
          </div>
        </section>

        <section className="stats-row" aria-label="Community report statistics">
          <div className="stat-block"><span className="stat-icon stat-purple"><Package size={18} /></span><div><strong>{activeItems.length}</strong><span>Active reports</span></div></div>
          <div className="stat-block"><span className="stat-icon stat-orange"><Search size={18} /></span><div><strong>{lostCount}</strong><span>Items lost</span></div></div>
          <div className="stat-block"><span className="stat-icon stat-green"><Check size={18} /></span><div><strong>{foundCount}</strong><span>Items found</span></div></div>
        </section>

        <section className="list-section" id="community-board">
          {showResultsFilters && (
            <div className="results-searchbar" aria-label="Search result filters">
              <label className="results-country"><Globe2 size={17} /><select value={country} onChange={(event) => setCountry(event.target.value)} aria-label="Filter by country">
                <option>South Korea</option><option>United States</option><option>United Kingdom</option><option>Uzbekistan</option><option>Japan</option><option>All countries</option>
              </select><ChevronDown size={14} /></label>
              <label className="results-location"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Key in Seoul" aria-label="Search by item or location" /></label>
              <label className="results-date"><Clock3 size={16} /><span className="date-label">Pick date</span><input type="date" value={pickedDate} onChange={(event) => setPickedDate(event.target.value)} aria-label="Filter items by date" /></label>
              <button className="results-search-button" type="button" onClick={() => document.getElementById("community-board")?.scrollIntoView({ behavior: "smooth" })} aria-label="Apply search"><Search size={19} /></button>
            </div>
          )}
          <div className="section-heading">
            <div>
              <div className="eyebrow">SEARCH THE FOUND ITEMS</div>
              <h2>Found items you may be looking for</h2>
              <p>Search sample and locally saved reports. Match suggestions are based on text and category, not a live AI service.</p>
            </div>
            
          </div>

          <div className="toolbar">
            <div className="filter-tabs" role="tablist" aria-label="Filter reports">
              {(["all", "lost", "found"] as const).map((value) => (
                <button
                  key={value}
                  className={filter === value ? "filter-tab selected" : "filter-tab"}
                  onClick={() => setFilter(value)}
                  role="tab"
                  aria-selected={filter === value}
                >
                  {value === "all" ? "All reports" : value === "lost" ? "Lost items" : "Found items"}
                </button>
              ))}
            </div>
            <label className="search-box">
              <Search size={17} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search items, places..." />
              <span className="search-shortcut"><Filter size={13} /></span>
            </label>
          </div>

          {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}
          {notice && <div className="alert alert-success" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss message"><X size={16} /></button></div>}

          {loading ? (
            <div className="empty-state"><div className="loader" /><strong>Loading campus reports...</strong></div>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon"><Compass size={26} /></span>
              <strong>{items.length === 0 ? "Your campus board is ready." : "No reports found."}</strong>
              <p>{items.length === 0 ? "Be the first to post a lost or found item." : "Try another search or filter."}</p>
              
            </div>
          ) : (
            <div className="item-grid">
              {filteredItems.map((item) => {
                const CategoryIcon = iconForCategory(item.category);
                return (
                  <article className="item-card" key={item.id}>
                    <div className={item.item_type === "lost" ? "item-visual visual-lost" : "item-visual visual-found"}>
                      <span className={item.item_type === "lost" ? "type-pill type-lost" : "type-pill type-found"}>{item.item_type === "lost" ? "LOST ITEM" : "FOUND ITEM"}</span>
                      {item.image_url && <img className="item-photo" src={item.image_url} alt={item.title} loading="lazy" onError={(event)=>{event.currentTarget.style.display="none";}}/>}
                      <CategoryIcon className="item-fallback-icon" size={48} strokeWidth={1.2} />
                      <span className="visual-corner">{item.category}</span>
                    </div>
                    <div className="item-content">
                      <div className="item-meta"><span><Clock3 size={13} /> {formatDate(item.created_at)}</span><span className="meta-dot">·</span><span>{item.campus}</span></div>
                      <h3>{item.title}</h3>
                      <p className="item-location"><MapPin size={14} /> {item.location}</p>
                      {item.description && <p className="item-description">{item.description}</p>}
                      <div className="item-footer">
                        <span className="category-tag"><Tag size={12} /> {item.category}</span>
                        <button className="match-link" onClick={() => void showMatches(item)}>This looks like mine <ArrowRight size={15} /></button>
                      </div>
                      {currentUser?.id === item.owner_id && <button className="resolve-link" onClick={() => void resolveItem(item)}>Mark resolved</button>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <div className="found-report-cta">
            <div>
              <span className="eyebrow">HELP SOMEONE GET IT BACK</span>
              <h3>Found something that belongs to someone else?</h3>
              <p>Register the item so its owner can search for it and identify it.</p>
            </div>
            <button className="button button-primary" type="button" onClick={() => openReport("found")}>
              <Plus size={17} /> I found something — Report it <ArrowRight size={17} />
            </button>
          </div>
        </section>

        <section className="community-promo">
          <div>
            <div className="eyebrow">BE READY BEFORE YOU LOSE IT</div>
            <h2>Register your valuables with FindIt AI.</h2>
            <p>Keep a record of the belongings that matter. If something goes missing, you’ll have the details ready to help identify it.</p>
          </div>
          <button className="button button-primary" onClick={() => document.getElementById("community-board")?.scrollIntoView({ behavior: "smooth" })}>Search items <ArrowRight size={17} /></button>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="eyebrow">SEARCH. MATCH. RECONNECT.</div>
          <h2>Lost & found, made simple.</h2>
          <div className="how-grid">
            <div className="how-card"><span className="how-number">01</span><span className="how-icon"><UploadCloud size={22} /></span><h3>Post a photo</h3><p>Share a photo and a few details about the item you lost or found.</p></div>
            <div className="how-card"><span className="how-number">02</span><span className="how-icon"><Sparkles size={22} /></span><h3>Compare possible matches</h3><p>FindIt ranks opposite-type reports using item names, categories, campus and location details.</p></div>
            <div className="how-card"><span className="how-number">03</span><span className="how-icon"><BadgeCheck size={22} /></span><h3>Verify & reconnect</h3><p>Check the details privately and arrange a safe handover.</p></div>
          </div>
        </section>

        <section className="global-network" id="organizations">
          <div className="global-network-inner">
            <div className="global-network-heading">
              <div>
                <span className="eyebrow"><Globe2 size={14}/> FINDIT AI · GLOBAL NETWORK</span>
                <h2>Lost somewhere.<br/><span>Found anywhere.</span></h2>
                <p>One discovery network for the things, vehicles and companions people are searching for — across campuses, cities and travel hubs.</p>
              </div>
              <div className="network-orbit"><Globe2 size={72}/><span className="orbit-pin pin-one"><MapPin size={16}/></span><span className="orbit-pin pin-two"><MapPin size={16}/></span><span className="orbit-pin pin-three"><MapPin size={16}/></span></div>
            </div>
            <div className="network-stats">
              <div><strong>01</strong><span>One connected platform</span></div>
              <div><strong>06</strong><span>Discovery categories</span></div>
              <div><strong>Worldwide</strong><span>Designed to scale across borders</span></div>
            </div>
            <div className="network-section-title"><div><span className="eyebrow">DISCOVER BY CATEGORY</span><h3>More than everyday lost items.</h3></div><span className="demo-label">CONCEPT SHOWCASE</span></div>
            <div className="network-map-heading"><div><span className="eyebrow">WORLDWIDE HOTSPOTS</span><h3>See where discoveries happen.</h3><p>Explore 26 illustrative city hotspots across 24 countries, each paired with a local cultural photo story.</p></div><span className="demo-label">ILLUSTRATIVE MAP · NOT LIVE ACTIVITY</span></div>
            <div className="network-map-layout">
              <div className="world-map-panel">
                <div className="world-map-topline"><span><span className="map-live-dot"/> GLOBAL DISCOVERY MAP</span><small>26 city hotspots · Approximate locations</small></div>
                <div className="world-map-canvas">
                  <img className="world-map-image" src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/BlankMap-Equirectangular.svg/960px-BlankMap-Equirectangular.svg.png" alt="Accurate equirectangular world map with country borders" loading="lazy"
decoding="async"/>
                  {([
                    {city:"Vancouver",lat:49.2827,lon:-123.1207,count:"18"},
                    {city:"New York",lat:40.7128,lon:-74.0060,count:"42"},
                    {city:"London",lat:51.5074,lon:-0.1278,count:"36"},
                    {city:"Dubai",lat:25.2048,lon:55.2708,count:"21"},
                    {city:"Seoul",lat:37.5665,lon:126.9780,count:"57"},
                    {city:"Tokyo",lat:35.6762,lon:139.6503,count:"49"},
                    {city:"Singapore",lat:1.3521,lon:103.8198,count:"28"},
                    {city:"Sydney",lat:-33.8688,lon:151.2093,count:"16"},
                    {city:"Paris",lat:48.8566,lon:2.3522,count:"31"},
                    {city:"Berlin",lat:52.5200,lon:13.4050,count:"24"},
                    {city:"Bangkok",lat:13.7563,lon:100.5018,count:"33"},
                    {city:"Beijing",lat:39.9042,lon:116.4074,count:"29"},
                    {city:"Buenos Aires",lat:-34.6037,lon:-58.3816,count:"19"},
                    {city:"Cairo",lat:30.0444,lon:31.2357,count:"26"},
                    {city:"Cape Town",lat:-33.9249,lon:18.4241,count:"17"},
                    {city:"Istanbul",lat:41.0082,lon:28.9784,count:"35"},
                    {city:"Lisbon",lat:38.7223,lon:-9.1393,count:"22"},
                    {city:"Melbourne",lat:-37.8136,lon:144.9631,count:"21"},
                    {city:"Mexico City",lat:19.4326,lon:-99.1332,count:"38"},
                    {city:"Mumbai",lat:19.0760,lon:72.8777,count:"32"},
                    {city:"Nairobi",lat:-1.2921,lon:36.8219,count:"18"},
                    {city:"São Paulo",lat:-23.5505,lon:-46.6333,count:"41"},
                    {city:"Taipei",lat:25.0330,lon:121.5654,count:"27"},
                    {city:"Toronto",lat:43.6532,lon:-79.3832,count:"30"},
                    {city:"Oslo",lat:59.9139,lon:10.7522,count:"23"},
                    {city:"Marrakech",lat:31.6295,lon:-7.9811,count:"20"}
                  ] as const).map((spot)=><button key={spot.city} className={activeHotspot===spot.city?"map-hotspot active":"map-hotspot"} style={{left:((spot.lon+180)/360*100)+"%",top:((90-spot.lat)/180*100)+"%"}} onClick={()=>setActiveHotspot(spot.city)} aria-label={"Select "+spot.city+" hotspot"}><span className="hotspot-pulse"/><span className="hotspot-count">{spot.count}</span></button>)}
                  <div className="map-legend"><span><i/> Discovery hotspot</span><span>Numbers are demo counts</span></div>
                </div>
              </div>
              <aside className="hotspot-sidebar">
                <span className="eyebrow">FEATURED HOTSPOT</span>
                <h4>{activeHotspot}</h4>
                <p>Illustrative community activity around a major city and travel hub.</p>
                <div className="hotspot-metrics"><strong>{({"Vancouver":"18","New York":"42","London":"36","Dubai":"21","Seoul":"57","Tokyo":"49","Singapore":"28","Sydney":"16","Paris":"31","Berlin":"24","Bangkok":"33","Beijing":"29","Buenos Aires":"19","Cairo":"26","Cape Town":"17","Istanbul":"35","Lisbon":"22","Melbourne":"21","Mexico City":"38","Mumbai":"32","Nairobi":"18","São Paulo":"41","Taipei":"27","Toronto":"30","Oslo":"23","Marrakech":"20"} as Record<string,string>)[activeHotspot]}</strong><span>sample reports</span></div>
                <div className="hotspot-culture">
                  <img src={hotspotCulture[activeHotspot].image} alt={hotspotCulture[activeHotspot].alt} loading="lazy"/>
                  <div className="hotspot-culture-copy">
                    <span>{hotspotCulture[activeHotspot].country} · LOCAL CULTURE</span>
                    <h5>{hotspotCulture[activeHotspot].title}</h5>
                    <p>{hotspotCulture[activeHotspot].description}</p>
                    <a href={hotspotCulture[activeHotspot].source} target="_blank" rel="noreferrer">Photo & story: {hotspotCulture[activeHotspot].sourceLabel} ↗</a>
                  </div>
                </div>
                <div className="hotspot-item-preview"><span className="eyebrow">ITEMS ON THIS MAP AREA</span>
                  {(({
                    "Seoul":[["Black leather wallet","Found"],["Wireless earbuds","Lost"],["Student backpack","Found"]],
                    "Tokyo":[["Blue cabin suitcase","Found"],["Camera case","Lost"],["Travel passport holder","Lost"]],
                    "London":[["Silver wristwatch","Found"],["Laptop sleeve","Lost"],["House keys","Found"]],
                    "New York":[["Smartphone","Lost"],["Gym duffel bag","Found"],["Bicycle","Lost"]],
                    "Dubai":[["Gold bracelet","Found"],["Carry-on luggage","Lost"],["Car key fob","Lost"]],
                    "Singapore":[["Tablet","Found"],["Blue umbrella","Lost"],["Transit card holder","Found"]],
                    "Vancouver":[["Golden retriever","Lost"],["Mountain bike","Found"],["Red scarf","Lost"]],
                    "Sydney":[["Surfboard","Lost"],["Sunglasses","Found"],["Camera","Lost"]],
                    "Paris":[["Leather handbag","Found"],["Metro pass holder","Lost"],["Camera lens","Lost"]],
                    "Berlin":[["Bicycle helmet","Lost"],["Canvas tote bag","Found"],["Wireless headphones","Lost"]],
                    "Bangkok":[["Phone pouch","Found"],["Temple-visit day bag","Lost"],["Motorbike key","Lost"]],
                    "Beijing":[["Glasses case","Lost"],["Travel wallet","Found"],["Camera strap","Lost"]],
                    "Buenos Aires":[["Football scarf","Lost"],["Leather card holder","Found"],["Earbuds","Lost"]],
                    "Cairo":[["Backpack","Lost"],["Silver ring","Found"],["Phone charger","Lost"]],
                    "Cape Town":[["Hiking daypack","Lost"],["Water bottle","Found"],["Sunglasses","Lost"]],
                    "Istanbul":[["Shopping bag","Lost"],["Scarf","Found"],["Travel document wallet","Lost"]],
                    "Lisbon":[["Compact camera","Lost"],["Blue backpack","Found"],["Transit card","Lost"]],
                    "Melbourne":[["Tram card holder","Lost"],["Laptop sleeve","Found"],["Bike light","Lost"]],
                    "Mexico City":[["Art notebook","Lost"],["Wallet","Found"],["Phone case","Lost"]],
                    "Mumbai":[["Umbrella","Lost"],["Lunch bag","Found"],["Earphones","Lost"]],
                    "Nairobi":[["Laptop bag","Lost"],["Water flask","Found"],["Travel pouch","Lost"]],
                    "São Paulo":[["Backpack","Lost"],["Sports cap","Found"],["Key ring","Lost"]],
                    "Taipei":[["Transit card case","Lost"],["Camera","Found"],["Umbrella","Lost"]],
                    "Toronto":[["Winter gloves","Lost"],["Lunch container","Found"],["Headphones","Lost"]],
                    "Oslo":[["Wool hat","Lost"],["Reusable bottle","Found"],["Gloves","Lost"]],
                    "Marrakech":[["Leather satchel","Lost"],["Sunglasses","Found"],["Phone charger","Lost"]]
                  } as Record<string,string[][]>)[activeHotspot]||[]).map(([name,status])=><div className="hotspot-item-row" key={name}><span className="hotspot-item-dot"/><span>{name}</span><b className={status==="Lost"?"is-lost":"is-found"}>{status}</b></div>)}
                </div>
                <div className="hotspot-city-list">{(["Seoul","Tokyo","London","New York","Dubai","Singapore","Vancouver","Sydney","Paris","Berlin","Bangkok","Beijing","Buenos Aires","Cairo","Cape Town","Istanbul","Lisbon","Melbourne","Mexico City","Mumbai","Nairobi","São Paulo","Taipei","Toronto","Oslo","Marrakech"] as const).map((city)=><button key={city} className={activeHotspot===city?"selected":""} onClick={()=>setActiveHotspot(city)}><MapPin size={14}/>{city}<span>Explore</span></button>)}</div>
                <small className="hotspot-disclaimer">Concept data only. These are not verified reports or real-time statistics.</small>
              </aside>
            </div>
            <div className="network-category-grid">
              <button className={networkCategory==="All"?"network-category active":"network-category"} onClick={()=>setNetworkCategory("All")}><span className="network-category-icon"><Compass/></span><strong>All discoveries</strong><small>Explore every category</small></button>
              <button className={networkCategory==="Personal items"?"network-category active":"network-category"} onClick={()=>setNetworkCategory("Personal items")}><span className="network-category-icon"><Wallet/></span><strong>Personal items</strong><small>Phones, wallets, keys</small></button>
              <button className={networkCategory==="Travel"?"network-category active":"network-category"} onClick={()=>setNetworkCategory("Travel")}><span className="network-category-icon"><Plane/></span><strong>Travel & luggage</strong><small>Bags and travel gear</small></button>
              <button className={networkCategory==="Vehicles"?"network-category active":"network-category"} onClick={()=>setNetworkCategory("Vehicles")}><span className="network-category-icon"><CarFront/></span><strong>Vehicles</strong><small>Cars, bikes, scooters</small></button>
              <button className={networkCategory==="Valuables"?"network-category active":"network-category"} onClick={()=>setNetworkCategory("Valuables")}><span className="network-category-icon"><Watch/></span><strong>Valuables</strong><small>Watches and jewelry</small></button>
              <button className={networkCategory==="Pets"?"network-category active":"network-category"} onClick={()=>setNetworkCategory("Pets")}><span className="network-category-icon"><PawPrint/></span><strong>Pets</strong><small>Lost and found animals</small></button>
            </div>
            <div className="network-section-title network-listing-title"><div><span className="eyebrow">GLOBAL DISCOVERY PREVIEW</span><h3>{networkCategory==="All"?"Explore what people may be searching for.":networkCategory+" discovery"}</h3><p>Illustrative sample listings to demonstrate the future global experience.</p></div><span className="demo-label">DEMO DATA · NOT LIVE REPORTS</span></div>
            <div className="network-listing-grid">
              {( [
                {category:"Personal items",title:"Black leather wallet",place:"Seoul, South Korea",status:"Found",image:"photo-1627123424574-724758594e93"},
                {category:"Travel",title:"Blue cabin suitcase",place:"Tokyo, Japan",status:"Found",image:"photo-1565026057447-bc90a3dceb87"},
                {category:"Vehicles",title:"White city bicycle",place:"Amsterdam, Netherlands",status:"Lost",image:"photo-1485965120184-e220f721d03e"},
                {category:"Valuables",title:"Silver wristwatch",place:"London, United Kingdom",status:"Found",image:"photo-1523275335684-37898b6baf30"},
                {category:"Pets",title:"Golden retriever",place:"Vancouver, Canada",status:"Lost",image:"photo-1552053831-71594a27632d"},
                {category:"Vehicles",title:"Blue compact car",place:"Los Angeles, United States",status:"Lost",image:"photo-1492144534655-ae79c964c9d7"}
              ] as const).filter((item)=>networkCategory==="All"||item.category===networkCategory).map((item)=>(
                <article className="network-listing-card" key={item.title}>
                  <div className="network-listing-image"><img src={`https://images.unsplash.com/${item.image}?auto=format&fit=crop&w=800&q=82`} alt={item.title}/><span className={item.status==="Lost"?"network-status lost":"network-status"}>{item.status}</span><span className="network-demo-stamp">DEMO</span></div>
                  <div className="network-listing-copy"><span>{item.category}</span><h4>{item.title}</h4><p><MapPin size={14}/>{item.place}</p></div>
                </article>
              ))}
            </div>
            <div className="network-safety-note"><ShieldCheck size={19}/><p><strong>Safety comes first.</strong> Public previews never expose private contact details or precise locations. Vehicle recovery and pet reunification should involve verified owners and appropriate local authorities.</p></div>
            <div className="network-org-heading"><span className="eyebrow">BUILT FOR COMMUNITIES & ORGANIZATIONS</span><h3>Connect the places where things get lost.</h3><p>FindIt AI can support different types of organizations as the network grows.</p></div>
            <div className="network-org-grid">
              <div><GraduationCap/><strong>Universities</strong><span>Campus offices, libraries and student services</span></div>
              <div><Plane/><strong>Airports & travel</strong><span>Terminals, airlines and transport hubs</span></div>
              <div><Building2/><strong>Venues & retail</strong><span>Malls, hotels, events and public spaces</span></div>
              <div><ShieldCheck/><strong>Verified authorities</strong><span>Safe referral pathways for sensitive cases</span></div>
            </div>
            <div className="network-bottom-cta"><div><span className="eyebrow">START WITH YOUR COMMUNITY</span><h3>Every successful reunion starts with a report.</h3><p>Search existing reports or contribute a lost or found item to your community.</p></div><button className="button button-primary" onClick={()=>document.getElementById("community-board")?.scrollIntoView({behavior:"smooth"})}>Explore item reports <ArrowRight size={17}/></button></div>
          </div>
        </section>

        <section className="faq-section" aria-labelledby="faq-title">
          <div className="faq-intro">
            <span className="eyebrow">GOOD TO KNOW</span>
            <h2 id="faq-title">A few helpful answers.</h2>
            <p>FindIt AI helps people discover possible matches while keeping personal details protected.</p>
          </div>
          <div className="faq-list">
            <details><summary>How do I report something I lost?</summary><p>Choose “I lost something”, add the item name, category, last-seen location and a photo, then submit your report.</p></details>
            <details><summary>How are possible matches ranked?</summary><p>This browser demo compares item names, descriptions, categories, campus, country and location. It does not run an AI model or compare image contents.</p></details>
            <details><summary>Can I report an item I found?</summary><p>Yes. Select “I found something” and include where and when you found it so its owner has useful clues.</p></details>
            <details><summary>Is a visual match proof that an item is mine?</summary><p>No. A match is only a suggestion. Confirm distinctive details privately before arranging a safe handover.</p></details>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand-column">
            <a className="brand" href="#discover" aria-label="FindIt AI home"><span className="brand-mark"><MapPin size={20} fill="currentColor" /></span><span className="brand-word">FindIt <span className="brand-ai">AI</span></span></a>
            <p>Helping campus communities bring lost belongings back to the people who matter.</p>
            <span className="footer-status"><span className="live-dot" /> FindIt AI community platform</span>
          </div>
          <div className="footer-column"><strong>For individuals</strong><a href="#community-board">Search items</a><button onClick={() => openReport("lost")}>Report a lost item</button><button onClick={() => openReport("found")}>Report a found item</button><a href="#how-it-works">How it works</a></div>
          <div className="footer-column"><strong>For organizations</strong><a href="#organizations">Campus solutions</a><a href="#organizations">Events & venues</a><a href="#organizations">Community partnerships</a></div>
          <div className="footer-column"><strong>FindIt AI</strong><a href="#discover">About the platform</a><a href="#faq-title">Help & FAQs</a><a href="#discover">Privacy-first design</a></div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} FindIt AI. All rights reserved.</span><span>Designed for safer, simpler reunions.</span></div>
      </footer>

      {showAuth && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAuth(false); }}>
          <section className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <div className="modal-header">
              <div>
  <div className="eyebrow">
    <ShieldCheck size={13} /> {isSupabaseConfigured ? "SECURE ACCOUNT" : "LOCAL DEMO PROFILE"}
  </div>

  <h2 id="auth-title">
    {authMode === "login"
      ? "Welcome back"
      : isSupabaseConfigured ? "Create your account" : "Create a demo profile"}
  </h2>

  <p>
    {isSupabaseConfigured
      ? "Your account is protected by Supabase Authentication. Use your email and a unique password."
      : "This profile is stored in this browser only. It is not a shared or secure account."}
  </p>
</div>
            </div>
            {authError && <div className="alert alert-error" role="alert">{authError}</div>}
            <form className="report-form auth-form" onSubmit={submitAuth}>
              <label className="field-label">
  Email address
  <input
    type="email"
    required
    autoComplete="email"
    value={authEmail}
    onChange={(event) => setAuthEmail(event.target.value)}
    placeholder="you@university.edu"
  />
</label>
              {isSupabaseConfigured ? (
                <label className="field-label">Password
                  <input
                    type="password"
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete={authMode === "login" ? "current-password" : "new-password"}
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    placeholder="At least 8 characters"
                  />
                </label>
              ) : (
                <p className="privacy-note">Demo mode only: no password is used and this profile cannot be shared across devices.</p>
              )}
              <button className="button button-primary submit-button" type="submit" disabled={authBusy}>{authBusy ? "Please wait..." : authMode === "login" ? "Sign in" : "Create account"} <ArrowRight size={17} /></button>
            </form>
            <p className="auth-switch">{authMode === "login" ? "New to FindIt AI?" : "Already have an account?"} <button onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }}>{authMode === "login" ? "Create an account" : "Sign in"}</button></p>
          </section>
        </div>
      )}

      {showReport && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowReport(false); }}>
          <section className="modal report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
            <div className="modal-header">
              <div><div className="eyebrow">CAMPUS COMMUNITY</div><h2 id="report-title">Create a report</h2><p>Give the community enough detail to help.</p></div>
              <button className="icon-button" onClick={() => setShowReport(false)} aria-label="Close report form"><X size={20} /></button>
            </div>
            <div className="type-switch">
              <button className={reportType === "lost" ? "type-option active-lost" : "type-option"} onClick={() => setReportType("lost")}><Search size={16} /> I lost this</button>
              <button className={reportType === "found" ? "type-option active-found" : "type-option"} onClick={() => setReportType("found")}><Check size={16} /> I found this</button>
            </div>
            <form onSubmit={submitReport} className="report-form">
              <label className="field-label">Item name<input required minLength={2} maxLength={120} value={form.title} onChange={(event) => updateForm("title", event.target.value)} placeholder="e.g. Black leather wallet" /></label>
              <div className="form-row">
                <label className="field-label">Category<select value={form.category} onChange={(event) => updateForm("category", event.target.value)}><option>Electronics</option><option>Accessories</option><option>Documents</option><option>Books</option><option>Clothing</option><option>Personal item</option><option>Other</option></select><ChevronDown className="select-chevron" size={15} /></label>
                <label className="field-label">Campus<input required minLength={2} maxLength={120} value={form.campus} onChange={(event) => updateForm("campus", event.target.value)} /></label>
              </div>
              <label className="field-label">Where was it {reportType === "lost" ? "last seen" : "found"}?<input required minLength={2} maxLength={160} value={form.location} onChange={(event) => updateForm("location", event.target.value)} placeholder="e.g. Central Library, 2nd floor" /></label>
              <label className="field-label">Additional details <span className="optional-label">Optional</span><textarea maxLength={1000} rows={3} value={form.description} onChange={(event) => updateForm("description", event.target.value)} placeholder="Color, brand, or other helpful details..." /></label>
              <label className="field-label">Item photo <span className="required-label">Required</span>
                <span className="upload-box">
                  {previewUrl ? <img src={previewUrl} alt="Selected item preview" className="upload-preview" /> : <span className="upload-placeholder"><UploadCloud size={25} /><strong>Choose an image</strong><small>JPG, PNG or WEBP · up to 5 MB</small></span>}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    required
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0] ?? null;
                      if (!file) {
                        setSelectedFile(null);
                        return;
                      }
                      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
                      if (!allowedTypes.includes(file.type)) {
                        setSelectedFile(null);
                        setError("Choose a JPG, PNG, or WEBP image.");
                        event.currentTarget.value = "";
                        return;
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        setSelectedFile(null);
                        setError("Your image must be smaller than 5 MB.");
                        event.currentTarget.value = "";
                        return;
                      }
                      setError("");
                      setSelectedFile(file);
                    }}
                  />
                </span>
              </label>
              <p className="privacy-note"><ShieldCheck size={15} /> {isSupabaseConfigured ? "Photos are uploaded to the shared FindIt AI photo bucket." : "Photos are stored in this browser only."} Avoid including personal contact details or sensitive information in photos or descriptions.</p>
              <button className="button button-primary submit-button" type="submit" disabled={submitting}>{submitting ? "Submitting report..." : "Submit report"} <ArrowRight size={17} /></button>
            </form>
          </section>
        </div>
      )}

      {matchesFor && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMatchesFor(null); }}>
          <section className="modal matches-modal" role="dialog" aria-modal="true" aria-labelledby="matches-title">
            
<div className="modal-header">
  <div>
    <div className="eyebrow">
      <Search size={13} /> LOCAL TEXT MATCHING
    </div>

    <h2 id="matches-title">Possible matches</h2>

    <p>
      For "{matchesFor.title}" · {matchesFor.item_type} report
    </p>
  </div>

  <button
    className="icon-button"
    onClick={() => setMatchesFor(null)}
    aria-label="Close matches"
  >
    <X size={20} />
  </button>
</div>

{matches.length === 0 ? (
  <div className="empty-state compact">
    <span className="empty-icon">
      <Search size={24} />
    </span>
    <strong>No strong matches yet</strong>
    <p>
      Try adding more details or check again when new
      reports are available.
    </p>
  </div>
) : (
  <div className="match-results">
    {matches.map((match) => (
      <div className="match-result" key={match.id}>
        <div className="match-result-icon">
          <Package size={22} />
        </div>

        <div className="match-result-info">
          <strong>{match.title}</strong>

          <span>
            {match.item_type} · {match.category}
          </span>

          <small>
            <MapPin size={12} />
            {match.campus} · {match.location}
          </small>

          <small>
            {match.matchReasons.join(" · ")}
          </small>
        </div>

        <div className="similarity">
          <strong>{match.matchScore}/100</strong>
          <span>match points</span>
        </div>
      </div>
    ))}
  </div>
)}

<p className="match-disclaimer">
  <ShieldCheck size={15} />
  Suggestions are ranked using text and location details.
  This is not AI or image recognition, and a match does
  not prove ownership.
</p>

          </section>
        </div>
      )}
    </div>
  );
}
