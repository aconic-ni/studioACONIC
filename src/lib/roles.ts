import type { UserRole } from '@/types';
import {
  Shield,
  ListTodo,
  PieChart,
  Database,
  Camera,
  FileSpreadsheet,
  Search,
  StickyNote,
  Banknote,
  BookOpen,
  GitBranch,
  ShieldCheck,
  Briefcase,
  Users,
  LayoutDashboard,
  FileDigit,
  Scale, // Added for legal
} from 'lucide-react';

export type NavLink = 'admin' | 'assignments' | 'dashboard' | 'dbPrevios' | 'dbPagos' | 'dbMemorandum' | 'dbPermisos' | 'dbValidaciones' | 'photos' | 'reportsPrevios' | 'reportsAforo' | 'agenteCasos' | 'supervisor' | 'executive' | 'reporter' | 'facturacion' | 'legal' | 'legalRequest';

export interface RoleConfig {
  home: string;
  navLinks: NavLink[];
}

export const roleConfig: Record<UserRole, RoleConfig> = {
  admin: {
    home: '/admin',
    navLinks: ['admin', 'assignments', 'dashboard', 'dbPrevios', 'dbPagos', 'dbMemorandum', 'dbPermisos', 'dbValidaciones', 'photos', 'reportsPrevios', 'reportsAforo', 'facturacion', 'legalRequest'],
  },
  coordinadora: {
    home: '/executive',
    navLinks: ['assignments', 'dashboard', 'dbPrevios', 'dbPagos', 'dbMemorandum', 'dbPermisos', 'dbValidaciones', 'photos', 'reportsPrevios', 'legalRequest', 'reporter', 'facturacion'],
  },
  supervisor: {
    home: '/supervisor',
    navLinks: ['assignments', 'dashboard', 'dbPrevios', 'dbPagos', 'dbMemorandum', 'dbPermisos', 'dbValidaciones', 'photos', 'reportsPrevios', 'agenteCasos'],
  },
  ejecutivo: {
    home: '/executive',
    navLinks: ['dashboard', 'dbPrevios', 'dbPagos', 'dbMemorandum', 'dbPermisos', 'photos', 'reportsPrevios', 'legalRequest'],
  },
  gestor: {
    home: '/examiner',
    navLinks: ['dbPrevios', 'photos'],
  },
  aforador: {
    home: '/database',
    navLinks: ['dashboard', 'dbPrevios', 'photos'],
  },
  agente: {
    home: '/agente',
    navLinks: ['dbPrevios', 'photos', 'agenteCasos'],
  },
  digitador: {
    home: '/thereporter',
    navLinks: ['reportsAforo', 'photos'],
  },
  revisor: {
    home: '/databasePay',
    navLinks: ['dbPagos', 'dbMemorandum', 'dbValidaciones', 'photos'],
  },
  calificador: {
    home: '/databasePay',
    navLinks: ['dbPagos', 'dbMemorandum', 'dbValidaciones', 'photos'],
  },
  autorevisor: {
    home: '/databasePay',
    navLinks: ['dbPagos', 'dbMemorandum', 'photos'],
  },
  autorevisor_plus: {
    home: '/databasePay',
    navLinks: ['dbPagos', 'dbMemorandum', 'photos'],
  },
  invitado: {
    home: '/permisos',
    navLinks: ['dbPermisos'],
  },
  facturador: {
    home: '/facturacion',
    navLinks: ['facturacion', 'dbPrevios', 'dbPagos', 'photos'],
  },
  legal: {
      home: '/legal',
      navLinks: ['dashboard', 'dbPagos', 'dbMemorandum', 'dbPermisos', 'dbValidaciones', 'photos', 'legal'],
  }
};

export const navLinkDetails: Record<NavLink, { href: string; label: string; icon: React.ElementType; isExternal?: boolean }> = {
  admin: { href: '/admin', label: 'Admin', icon: Shield },
  assignments: { href: '/assignments', label: 'Asignaciones', icon: ListTodo },
  dashboard: { href: '/dashboard', label: 'Dashboard', icon: PieChart },
  dbPrevios: { href: '/database', label: 'Base de Datos (Previos)', icon: BookOpen },
  dbPagos: { href: '/databasePay', label: 'Base de Datos (Pagos)', icon: Banknote },
  dbMemorandum: { href: '/memorandum', label: 'Memorandos (RH)', icon: StickyNote },
  dbPermisos: { href: '/permisos', label: 'Gestión de Permisos', icon: GitBranch },
  dbValidaciones: { href: '/validaciones', label: 'Validaciones', icon: ShieldCheck },
  photos: { href: 'https://aconisani-my.sharepoint.com/:f:/g/personal/asuntos_juridicos_aconic_com_ni/Emrpj4Ss8bhDifpuYc8U_bwBj9r29FGcXxzfxu4PSh2tEQ?e=tkoEC0', label: 'Fotos', icon: Camera, isExternal: true },
  reportsPrevios: { href: '/reports', label: 'Reportes de Previos', icon: PieChart },
  reportsAforo: { href: '/thereporter', label: 'Reportes de Aforo', icon: Search },
  agenteCasos: { href: '/agente/casos', label: 'Gestión de Casos', icon: Briefcase },
  supervisor: { href: '/supervisor', label: 'Panel Supervisor', icon: Users },
  executive: { href: '/executive', label: 'Módulo Ejecutivo', icon: Briefcase },
  reporter: { href: '/thereporter', label: 'Módulo Aforador', icon: Search },
  facturacion: { href: '/facturacion', label: 'Facturación', icon: FileDigit },
  legal: { href: '/legal', label: 'Módulo Legal', icon: Scale },
  legalRequest: { href: '/legal/request', label: 'Solicitud Legal', icon: Scale },
};
