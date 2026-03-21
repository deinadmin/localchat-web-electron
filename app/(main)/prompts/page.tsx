import { IconLibrary, IconPlus } from "@tabler/icons-react";
import { TitleBar } from "@/components/title-bar";
import { Button } from "@/components/ui/button";

function PromptsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center min-h-[60vh]">
      <div className="rounded-full bg-muted p-4 mb-4">
        <IconLibrary className="size-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No prompts saved</h2>
      <p className="text-muted-foreground max-w-sm">
        Your saved prompts will appear here.
      </p>
    </div>
  );
}

export default function PromptsPage() {
  return (
    <div className="relative flex flex-col h-screen bg-background overflow-hidden">
      <TitleBar showStickyTitle stickyTitle="Prompt Library" />
      <div className="flex-1 overflow-y-auto pt-6">
        <div className="mx-auto px-4 py-6 max-w-5xl">
          <div className="mb-8 flex items-center justify-between" data-title>
            <div>
              <h1 className="text-2xl font-bold">Prompt Library</h1>
              <p className="text-muted-foreground text-sm">
                A collection of your favorite prompts.
              </p>
            </div>
            <Button variant="outline">
              <IconPlus className="size-4" />
              New Prompt
            </Button>
          </div>
          <PromptsEmptyState />
        </div>
      </div>
    </div>
  );
}
