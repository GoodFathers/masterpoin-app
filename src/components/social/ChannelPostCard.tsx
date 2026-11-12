"use client";

import { Heart, Eye, MoreVertical, Trash2 } from "lucide-react";
import { cn, timeAgo } from "@/lib/wa-utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ChannelPostT = {
  id: string;
  channelId: string;
  body: string;
  imageUrl: string | null;
  likes: number;
  likedByMe: boolean;
  views: number;
  createdAt: string;
};

/** Kartu satu unggahan channel: teks / gambar, tombol suka, jumlah dilihat, waktu relatif, menu hapus opsional. */
export default function ChannelPostCard({
  post,
  onToggleLike,
  onDelete,
}: {
  post: ChannelPostT;
  onToggleLike: (post: ChannelPostT) => void;
  onDelete?: (post: ChannelPostT) => void;
}) {
  return (
    <div className="px-3 py-3 sm:px-4">
      {post.body ? (
        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{post.body}</p>
      ) : null}
      {post.imageUrl ? (
        <img
          src={post.imageUrl}
          alt="Lampiran unggahan channel"
          className={cn("max-h-72 w-full rounded-xl border border-border object-cover", post.body && "mt-2")}
        />
      ) : null}
      <div className="mt-2.5 flex items-center gap-4 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => onToggleLike(post)}
          aria-label={post.likedByMe ? "Batal suka unggahan ini" : "Sukai unggahan ini"}
          aria-pressed={post.likedByMe}
          className={cn(
            "flex min-h-[28px] items-center gap-1.5 rounded-md px-1 transition-colors hover:text-red-500",
            post.likedByMe && "text-red-500"
          )}
        >
          <Heart className={cn("h-4 w-4", post.likedByMe && "fill-current")} />
          <span className="font-medium tabular-nums">{post.likes}</span>
        </button>
        <span className="flex items-center gap-1.5" aria-label={`Dilihat ${post.views} kali`}>
          <Eye className="h-4 w-4" />
          <span className="tabular-nums">{post.views}</span>
        </span>
        <span className="ml-auto">{timeAgo(post.createdAt)}</span>
        {onDelete ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Menu unggahan">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(post)}>
                <Trash2 />
                Hapus unggahan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
