import { Header } from "@/components/Header";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-center w-full h-full min-h-[calc(100vh-150px)] border-2 border-dashed rounded-lg border-muted-foreground/30">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Blank Canvas
            </h2>
            <p className="mt-2 text-muted-foreground">
              Start building your page by adding a new component.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
