
import { IconLibrary, IconPlus } from "@tabler/icons-react";
import { TitleBar } from "@/components/title-bar";
import { Button } from "@/components/ui/button";

function ImagesEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center min-h-[60vh]">
      <div className="rounded-full bg-muted p-4 mb-4">
        <IconLibrary className="size-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No images yet</h2>
      <p className="text-muted-foreground max-w-sm">
        Time to generate your first one!
      </p>
    </div>
  );
}

export default function ImagesPage() {
  return (
    <div className="relative flex flex-col h-screen bg-background overflow-hidden">
      <TitleBar showStickyTitle stickyTitle="Prompt Library" />
      <div className="flex-1 overflow-y-auto pt-6">
        <div className="mx-auto px-4 py-6 max-w-5xl">
          <div className="mb-8 flex items-center justify-between" data-title>
            <div>
              <h1 className="text-2xl font-bold">Images</h1>
              <p className="text-muted-foreground text-sm">
                A library of your generated images.
              </p>
            </div>
            <Button variant="outline">
              <IconPlus className="size-4" />
              New Image
            </Button>
          </div>
          <ImagesEmptyState />
        </div>
      </div>
    </div>
  );
}
