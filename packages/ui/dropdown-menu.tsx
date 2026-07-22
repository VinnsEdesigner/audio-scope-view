import * as React from "react";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";
import { ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator } from "./context-menu";
import { Text, styled } from "tamagui";

const DropdownMenu = Popover;
const DropdownMenuTrigger = PopoverTrigger;
const DropdownMenuContent = ContextMenuContent;
const DropdownMenuItem = ContextMenuItem;
const DropdownMenuCheckboxItem = ContextMenuItem;
const DropdownMenuRadioItem = ContextMenuItem;
const DropdownMenuLabel = ContextMenuLabel;
const DropdownMenuSeparator = ContextMenuSeparator;

const DropdownMenuShortcut = styled(Text, {
  marginLeft: "auto",
  fontSize: 12,
  color: "$gray9",
});

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
};
