import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ApiKnowledgeGateProps {
  confirmed: boolean;
  onConfirm: () => void;
  onBack: () => void;
  children: ReactNode;
}

/**
 * Blocks the API Info / API Key / API Docs content behind a confirmation popup.
 * The children are not rendered at all until the user confirms they know what an API is.
 */
export default function ApiKnowledgeGate({ confirmed, onConfirm, onBack, children }: ApiKnowledgeGateProps) {
  if (confirmed) return <>{children}</>;

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Do you know what an API is?</AlertDialogTitle>
          <AlertDialogDescription>
            This section is for people who know what an API is and what it is used for, for example to connect their
            own website or app to our platform. If you do not know what an API is, you do not need it. You can sell
            data without it, so tap back to return.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onBack}>No, take me back</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Yes, I know what it is used for</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
