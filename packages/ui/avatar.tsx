import * as React from "react";
import { Avatar as TamaguiAvatar, YStack, Text, styled } from "tamagui";

const AvatarRoot = styled(TamaguiAvatar.Root, {
  width: 40,
  height: 40,
  borderRadius: "$full",
  overflow: "hidden",
});

const AvatarImage = styled(TamaguiAvatar.Image, {
  width: "100%",
  height: "100%",
  objectFit: "cover",
});

const AvatarFallback = styled(TamaguiAvatar.Fallback, {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "$gray4",
});

export {
  AvatarRoot as Avatar,
  AvatarImage,
  AvatarFallback,
};

