
"use client";
import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { LogOut, UserCircle, Menu, X, Database } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose
} from "@/components/ui/sheet";
import { IncidentNotificationPanel } from '../reporter/IncidentNotificationPanel';
import { roleConfig, navLinkDetails, type NavLink } from '@/lib/roles';
import type { UserRole } from '@/types';
import { ScrollArea } from '../ui/scroll-area';

const renderAppIdentity = (user: any) => {
    // Use the role config to determine the home path
    let homePath = '/';
    if (user) {
        const userRole = user.role || 'gestor';
        const roleToUse: UserRole = user.roleTitle === 'agente aduanero' ? 'agente' : userRole;
        const config = roleConfig[roleToUse];
        if (config) {
            homePath = config.home;
        }
    }
    
    const LogoIcon = navLinkDetails['reportsPrevios'].icon;

    return (
        <Link href={homePath}>
            <div className="flex items-center gap-2">
                <LogoIcon className="h-8 w-8 text-primary" />
                <h1 className="text-xl md:text-2xl font-bold text-foreground">CustomsEX-p</h1>
            </div>
        </Link>
    );
};


export function AppHeader() {
  const { user, logout, loading } = useAuth();
  
  const getVisibleNavLinks = (): NavLink[] => {
    if (!user) return [];
    const userRole = user.role || 'gestor';
    const roleToUse: UserRole = user.roleTitle === 'agente aduanero' ? 'agente' : userRole;
    const config = roleConfig[roleToUse];
    return config ? config.navLinks : [];
  };

  const visibleNavLinks = getVisibleNavLinks();

  const NavLinkComponent: React.FC<{navKey: NavLink, isMobile?: boolean}> = ({ navKey, isMobile = false }) => {
    const details = navLinkDetails[navKey];
    if (!details) return null;

    const commonProps = {
      variant: "ghost" as const,
      className: isMobile ? "w-full justify-start text-base gap-4" : "text-primary hover:bg-accent hover:text-accent-foreground transition-all duration-300"
    };

    const Icon = details.icon;
    const content = (
      <>
        <Icon className="h-5 w-5" />
        {isMobile && <span>{details.label}</span>}
      </>
    );
    
    const buttonContent = (
       details.isExternal ? (
        <a href={details.href} target="_blank" rel="noopener noreferrer" aria-label={details.label}>
          <Button {...commonProps} size={isMobile ? "default" as const : "icon" as const} asChild={false}>
            {content}
          </Button>
        </a>
       ) : (
        <Link href={details.href} passHref>
           <Button {...commonProps} size={isMobile ? "default" as const : "icon" as const} asChild={false}>
             {content}
          </Button>
        </Link>
       )
    );
    
    const mobileButton = <SheetClose asChild>{buttonContent}</SheetClose>;

    if (isMobile) {
      return mobileButton;
    }
    
    // Desktop Version with Tooltip
    return (
       <Tooltip>
        <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
        <TooltipContent><p>{details.label}</p></TooltipContent>
      </Tooltip>
    );
  };

  const dbLinks: NavLink[] = ['dbPrevios', 'dbPagos', 'dbMemorandum', 'dbPermisos', 'dbValidaciones', 'facturacion'];
  const reportLinks: NavLink[] = ['reportsPrevios', 'reportsAforo'];

  const visibleDbLinks = dbLinks.filter(link => visibleNavLinks.includes(link));
  const visibleReportLinks = reportLinks.filter(link => visibleNavLinks.includes(link));

  const LogoIcon = navLinkDetails['reportsPrevios'].icon;

  return (
    <header className="bg-card shadow-sm sticky top-0 z-40">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
           {renderAppIdentity(user)}
          
          <TooltipProvider>
            <div className="hidden md:flex items-center gap-1">
              {loading ? (
                <div className="text-sm text-muted-foreground">Cargando...</div>
              ) : user ? (
                <>
                   <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
                        {(user.roleTitle || user.role) && <Badge variant="secondary">{user.roleTitle || user.role}</Badge>}
                        <UserCircle className="h-5 w-5" />
                        <span>{user.email}</span>
                   </div>
                  {((user.roleTitle === 'agente aduanero') || user.role === 'admin') && <IncidentNotificationPanel />}
                  
                  {visibleNavLinks.filter(key => !dbLinks.includes(key) && !reportLinks.includes(key)).map(key => (
                      <NavLinkComponent key={key} navKey={key} />
                  ))}

                  {visibleDbLinks.length > 0 && (
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-primary hover:bg-accent hover:text-accent-foreground transition-all duration-300">
                                <Database className="h-5 w-5" />
                              </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent><p>Bases de Datos</p></TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent>
                        {visibleDbLinks.map(key => {
                            const details = navLinkDetails[key];
                            const Icon = details.icon;
                            return (
                                <DropdownMenuItem key={key} asChild>
                                   <Link href={details.href}><Icon className="mr-2 h-4 w-4"/> {details.label}</Link>
                                </DropdownMenuItem>
                            )
                        })}
                      </DropdownMenuContent>
                  </DropdownMenu>
                  )}
                  
                  {visibleReportLinks.length > 0 && (
                     <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-primary hover:bg-accent hover:text-accent-foreground transition-all duration-300">
                                <LogoIcon className="h-5 w-5"/>
                              </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent><p>Reportes</p></TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent>
                        {visibleReportLinks.map(key => {
                             const details = navLinkDetails[key];
                             const Icon = details.icon;
                             return (
                                <DropdownMenuItem key={key} asChild>
                                   <Link href={details.href}><Icon className="mr-2 h-4 w-4"/> {details.label}</Link>
                                </DropdownMenuItem>
                            )
                        })}
                      </DropdownMenuContent>
                  </DropdownMenu>
                  )}


                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={logout}
                        className="text-primary hover:bg-destructive hover:text-destructive-foreground"
                        aria-label="Salir"
                      >
                        <LogOut className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Salir</p>
                    </TooltipContent>
                  </Tooltip>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">No autenticado</div>
              )}
            </div>
          </TooltipProvider>

          <div className="md:hidden">
             {user && (
                 <Sheet>
                   <SheetTrigger asChild>
                      <Button variant="default" size="icon">
                        <Menu className="h-6 w-6" />
                        <span className="sr-only">Abrir menú</span>
                      </Button>
                   </SheetTrigger>
                   <SheetContent side="right" className="w-[300px] p-0 flex flex-col">
                     <ScrollArea className="flex-1">
                        <div className="p-2 flex justify-end sticky top-0 bg-background z-10">
                            <SheetClose asChild>
                                <Button variant="destructive" size="icon">
                                <X className="h-6 w-6" />
                                <span className="sr-only">Close</span>
                                </Button>
                            </SheetClose>
                        </div>
                        <SheetHeader>
                           <SheetTitle className="sr-only">Menú de Navegación</SheetTitle>
                        </SheetHeader>

                       <div className="flex flex-col items-center gap-4 p-4 pt-0 border-b">
                         <div className="flex items-center justify-center gap-2">
                             <LogoIcon className="h-8 w-8 text-primary" />
                            <h1 className="text-xl md:text-2xl font-bold text-foreground">CustomsEX-p</h1>
                          </div>
                          {(user.roleTitle || user.role) && <Badge variant="secondary" className="mx-auto">{user.roleTitle || user.role}</Badge>}
                          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                              <UserCircle className="h-5 w-5" />
                              <span className="truncate">{user.email}</span>
                          </div>
                          {((user.roleTitle === 'agente aduanero') || user.role === 'admin') && (
                            <div className="mt-2 w-full">
                              <IncidentNotificationPanel isMobile={true} />
                            </div>
                           )}
                      </div>

                      <nav className="flex flex-col gap-2 p-4">
                        {visibleNavLinks.map(key => (
                          <NavLinkComponent key={key} navKey={key} isMobile />
                        ))}
                      </nav>
                     </ScrollArea>
                     <div className="p-4 border-t mt-auto">
                        <Button onClick={logout} variant="ghost" className="w-full justify-start text-base gap-4 text-destructive hover:text-destructive">
                           <LogOut className="h-5 w-5" />
                           <span>Salir</span>
                         </Button>
                      </div>
                   </SheetContent>
                 </Sheet>
             )}
          </div>
        </div>
      </div>
    </header>
  );
}
