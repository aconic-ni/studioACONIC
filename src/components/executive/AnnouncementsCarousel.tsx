"use client";

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import type { Announcement } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import Autoplay from 'embla-carousel-autoplay';
import Link from 'next/link';

export function AnnouncementsCarousel() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [api, setApi] = useState<CarouselApi>();

  const plugin = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })
  );

  useEffect(() => {
    const q = query(collection(db, 'avisos'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedAnnouncements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
      setAnnouncements(fetchedAnnouncements);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching announcements:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
        <Card className="w-full mx-auto custom-shadow">
            <CardContent className="pt-6">
                <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-3 py-1">
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                        <div className="space-y-2">
                        <div className="h-3 bg-muted rounded"></div>
                        <div className="h-3 bg-muted rounded w-5/6"></div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
  }

  if (announcements.length === 0) {
    return null; // Don't render anything if there are no announcements
  }

  const AnnouncementCard = ({ ann }: { ann: Announcement }) => (
    <Card className="h-full custom-shadow bg-card flex flex-col">
        <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-base font-semibold">{ann.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow py-2">
            <p className="text-sm text-card-foreground/80">{ann.content}</p>
        </CardContent>
        {ann.linkUrl && ann.linkText && (
            <CardFooter className="pt-2 pb-4">
                 <Button asChild variant="link" className="p-0 h-auto text-sm">
                    <a href={ann.linkUrl} target="_blank" rel="noopener noreferrer">
                        {ann.linkText}
                    </a>
                </Button>
            </CardFooter>
        )}
    </Card>
  );


  // Static layout for 1-3 announcements
  if (announcements.length > 0 && announcements.length <= 3) {
    return (
        <div className={`grid grid-cols-1 md:grid-cols-${announcements.length} gap-4`}>
            {announcements.map((ann) => (
                <AnnouncementCard key={ann.id} ann={ann} />
            ))}
        </div>
    );
  }

  // Carousel for 4+ announcements
  return (
    <Carousel
      setApi={setApi}
      plugins={[plugin.current]}
      className="w-full group/carousel"
      opts={{
        align: "start",
        loop: true,
      }}
    >
      <CarouselContent>
        {announcements.map((ann) => (
          <CarouselItem key={ann.id} className="md:basis-1/2 lg:basis-1/3">
            <div className="p-1 h-full">
              <AnnouncementCard ann={ann} />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/50 text-foreground border-border/50 backdrop-blur-sm opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-background/75" />
      <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/50 text-foreground border-border/50 backdrop-blur-sm opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-background/75" />
    </Carousel>
  );
}
