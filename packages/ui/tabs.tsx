import * as React from "react";
import { Tabs as TamaguiTabs, YStack, Text, styled } from "tamagui";

const TabsRoot = TamaguiTabs;

const TabsList = styled(TamaguiTabs.List, {
  flexDirection: "row",
  backgroundColor: "$gray3",
  borderRadius: "$md",
  padding: 4,
  gap: 4,
});

const TabsTrigger = styled(TamaguiTabs.Tab, {
  flex: 1,
  paddingVertical: 10,
  paddingHorizontal: 16,
  borderRadius: "$sm",
  cursor: "pointer",
  transition: "all 150ms",

  variants: {
    active: {
      true: {
        backgroundColor: "$gray1",
      },
      false: {
        backgroundColor: "transparent",
      },
    },
  } as const,
});

const TabsContent = styled(TamaguiTabs.Content, {
  paddingTop: "$md",
});

export interface TabsProps extends React.ComponentProps<typeof TabsRoot> {
  defaultValue?: string;
}

const Tabs = TabsRoot;
Tabs.displayName = "Tabs";

const TabsList_ = React.forwardRef<React.ElementRef<typeof TabsList>, React.ComponentProps<typeof TabsList>>(
  ({ children, ...props }, ref) => {
    return (
      <TabsList ref={ref} {...props}>
        {children}
      </TabsList>
    );
  },
);
TabsList_.displayName = "TabsList";

const TabsTrigger_ = React.forwardRef<React.ElementRef<typeof TabsTrigger>, React.ComponentProps<typeof TabsTrigger> & { value: string }>(
  ({ value, children, ...props }, ref) => {
    return (
      <TamaguiTabs.Tab value={value}>
        <TabsTrigger ref={ref} {...props}>
          <Text fontSize={14} fontWeight="500">
            {children}
          </Text>
        </TabsTrigger>
      </TamaguiTabs.Tab>
    );
  },
);
TabsTrigger_.displayName = "TabsTrigger";

const TabsContent_ = React.forwardRef<React.ElementRef<typeof TabsContent>, React.ComponentProps<typeof TabsContent> & { value: string }>(
  ({ value, children, ...props }, ref) => {
    return (
      <TamaguiTabs.Content value={value}>
        <TabsContent ref={ref} {...props}>
          {children}
        </TabsContent>
      </TamaguiTabs.Content>
    );
  },
);
TabsContent_.displayName = "TabsContent";

export { Tabs, TabsList_ as TabsList, TabsTrigger_ as TabsTrigger, TabsContent_ as TabsContent };

