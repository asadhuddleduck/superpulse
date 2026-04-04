export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-screen bg-black">
      <main className="flex flex-col items-center gap-6 text-center px-6">
        <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
          <span className="text-viridian">Super</span>
          <span className="text-sandstorm">Pulse</span>
        </h1>
        <p className="max-w-md text-lg text-zinc-400 leading-relaxed">
          AI-powered Instagram boosting for local businesses
        </p>
      </main>
    </div>
  );
}
