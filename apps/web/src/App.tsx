import { ForisCharacter } from '@/components/brand/foris-character'

function App() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-5 bg-background px-6 text-foreground">
      <ForisCharacter mood="welcome" width={112} height={112} />
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Foris</h1>
    </main>
  )
}

export default App
