import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  Users,
  FileSignature,
  Banknote,
  Calculator,
  Landmark,
  Gavel,
  Wrench,
  FolderOpen,
  Settings,
  CalendarDays,
  Mail,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { key: string; href: string; icon: LucideIcon };
export type NavGroup = { labelKey: string; items: NavItem[] };

// href ohne Locale-Präfix — <Link> aus next-intl ergänzt es.
export const navGroups: NavGroup[] = [
  {
    labelKey: "nav.groupManagement",
    items: [
      { key: "nav.dashboard", href: "/", icon: LayoutDashboard },
      { key: "nav.properties", href: "/properties", icon: Building2 },
      { key: "nav.units", href: "/units", icon: DoorOpen },
      { key: "nav.persons", href: "/persons", icon: Users },
      { key: "nav.leases", href: "/leases", icon: FileSignature },
    ],
  },
  {
    labelKey: "nav.groupFinance",
    items: [
      { key: "nav.finances", href: "/finances", icon: Banknote },
      { key: "nav.statements", href: "/statements", icon: Calculator },
      { key: "nav.weg", href: "/weg", icon: Landmark },
      { key: "nav.meetings", href: "/meetings", icon: Gavel },
    ],
  },
  {
    labelKey: "nav.groupOperations",
    items: [
      { key: "nav.calendar", href: "/calendar", icon: CalendarDays },
      { key: "nav.tickets", href: "/tickets", icon: Wrench },
      { key: "nav.documents", href: "/documents", icon: FolderOpen },
      { key: "nav.email", href: "/email", icon: Mail },
    ],
  },
  {
    labelKey: "nav.groupAdmin",
    items: [
      { key: "nav.audit", href: "/audit", icon: ScrollText },
      { key: "nav.settings", href: "/settings", icon: Settings },
    ],
  },
];
