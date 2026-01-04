import PhysicsCanvas from "./components/PhysicsCanvas";

export default function Home() {
  return (
    <div className="flex h-screen bg-zinc-50 font-sans dark:bg-black">
      <main className="flex h-full w-full flex-col p-6 bg-white dark:bg-black gap-6">
        <h1 className="text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
          Number Sense
        </h1>
        <PhysicsCanvas />
      </main>
    </div>
  );
}
