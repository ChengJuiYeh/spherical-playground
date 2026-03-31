import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Discrete Geometry Playground
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-gray-600">
            Interactive playgrounds for energy minimization problems on various spaces.
            Start with the sphere or the flat torus.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Link
            href="/sphere"
            className="group rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="text-2xl font-semibold">Spherical Playground</div>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Energy minimization on the sphere, with visualization, Gram matrix, graph structure,
              and LP bound tools.
            </p>
            <div className="mt-5 text-sm font-medium text-black">Enter →</div>
          </Link>

          <Link
            href="/torus"
            className="group rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="text-2xl font-semibold">Flat Torus Playground</div>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Energy minimization on the flat torus with periodic boundary conditions and tiled
              visualization.
            </p>
            <div className="mt-5 text-sm font-medium text-black">Enter →</div>
          </Link>
        </div>
      </div>
    </main>
  );
}