import * as React from "react";
import { styled, YStack } from "tamagui";

const Table = styled(YStack, {
  width: "100%",
  flexDirection: "column",
  borderRadius: "$md",
  overflow: "hidden",
});

const TableHeader = styled(YStack, {
  flexDirection: "column",
});

const TableBody = styled(YStack, {
  flexDirection: "column",
});

const TableRow = styled(YStack, {
  flexDirection: "row",
  borderBottomWidth: 1,
  borderBottomColor: "$border",
  cursor: "pointer",
});

const TableHead = styled(YStack, {
  padding: 12,
  fontWeight: "600",
  fontSize: 13,
  color: "$gray10",
  textAlign: "left",
});

const TableCell = styled(YStack, {
  padding: 12,
  fontSize: 14,
  color: "$gray12",
});

const TableCaption = styled(YStack, {
  marginTop: 16,
  fontSize: 14,
  color: "$gray9",
});

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
};

