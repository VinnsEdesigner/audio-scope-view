import * as React from "react";
import { YStack, XStack, Text, Button, styled } from "tamagui";

const PaginationRoot = styled(YStack, {
  flexDirection: "row",
  justifyContent: "center",
  width: "100%",
});

const PaginationContent = styled(XStack, {
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
});

const PaginationItem = styled(XStack, {
  cursor: "pointer",
});

const PaginationLink = styled(Button, {
  cursor: "pointer",
});

const PaginationEllipsis = styled(Text, {
  width: 32,
  height: 32,
  justifyContent: "center",
  alignItems: "center",
});

export {
  PaginationRoot as Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
};
