
"use client";
import type React from 'react';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ExamData, Product, AppUser as AuthAppUser, ExamDocument, AuditLogEntry, SolicitudData, InitialDataContext, AforoCase } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './AuthContext';
import { doc, setDoc, Timestamp, addDoc, collection, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export enum ExamStep {
  WELCOME = 0,
  INITIAL_INFO = 1,
  PRODUCT_LIST = 2,
  PREVIEW = 3,
  SUCCESS = 4,
  INITIAL_DATA = 1, // Re-using for examinerPay
  SOLICITUD_LIST = 2, // Re-using for examinerPay
}

interface AppContextType {
  examData: ExamData | null;
  products: Product[];
  currentStep: ExamStep;
  editingProduct: Product | null;
  isAddProductModalOpen: boolean;
  isProductDetailModalOpen: boolean;
  productToView: Product | null;
  selectedProducts: string[];
  setExamData: (data: ExamData, isRecovery?: boolean) => void;
  setProducts: (products: Product[]) => void;
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (updatedProduct: Product) => void;
  deleteProduct: (productId: string) => void;
  setCurrentStep: (step: ExamStep) => void;
  setEditingProduct: (product: Product | null) => void;
  openAddProductModal: (productToEdit?: Product | SolicitudData | null) => void;
  closeAddProductModal: () => void;
  openProductDetailModal: (product: Product) => void;
  closeProductDetailModal: () => void;
  resetApp: () => void;
  softSaveExam: (examData: ExamData, products: Product[]) => Promise<void>;
  toggleProductSelection: (productId: string) => void;
  toggleSelectAllProducts: () => void;
  deleteSelectedProducts: () => void;

  // New state for examinerPay flow
  initialContextData: InitialDataContext | null;
  setInitialContextData: (data: InitialDataContext) => void;
  solicitudes: SolicitudData[];
  addSolicitud: (solicitud: Omit<SolicitudData, 'id'>) => void;
  updateSolicitud: (solicitud: SolicitudData) => void;
  deleteSolicitud: (solicitudId: string) => void;
  editingSolicitud: SolicitudData | null;
  openSolicitudModal: (solicitud?: SolicitudData) => void;
  isMemorandumMode: boolean;
  setIsMemorandumMode: (isMemo: boolean) => void;
  solicitudToViewInline: SolicitudData | null;
  setSolicitudToViewInline: (solicitud: SolicitudData | null) => void;

  // For PSMT special flow
  caseToAssignAforador: AforoCase | null;
  setCaseToAssignAforador: (caseData: AforoCase | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [examData, setExamDataState] = useState<ExamData | null>(null);
  const [products, setProductsState] = useState<Product[]>([]);
  const [currentStep, setCurrentStepState] = useState<ExamStep>(ExamStep.WELCOME);
  const [editingProduct, setEditingProductState] = useState<Product | null>(null);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isProductDetailModalOpen, setIsProductDetailModalOpen] = useState(false);
  const [productToView, setProductToView] = useState<Product | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false); // New state for audit trail
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  
  // State for examinerPay flow
  const [initialContextData, setInitialContextDataState] = useState<InitialDataContext | null>(null);
  const [solicitudes, setSolicitudes] = useState<SolicitudData[]>([]);
  const [editingSolicitud, setEditingSolicitud] = useState<SolicitudData | null>(null);
  const [isMemorandumMode, setIsMemorandumMode] = useState(false);
  const [solicitudToViewInline, setSolicitudToViewInline] = useState<SolicitudData | null>(null);

  // For PSMT special flow
  const [caseToAssignAforador, setCaseToAssignAforador] = useState<AforoCase | null>(null);

  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const [internalUser, setInternalUser] = useState<AuthAppUser | null>(authUser);

  const resetApp = useCallback(() => {
    setExamDataState(null);
    setProductsState([]);
    setCurrentStepState(ExamStep.WELCOME);
    setEditingProductState(null);
    setIsAddProductModalOpen(false);
    setIsProductDetailModalOpen(false);
    setProductToView(null);
    setIsRecoveryMode(false);
    setSelectedProducts([]);
    // Reset examinerPay state
    setInitialContextDataState(null);
    setSolicitudes([]);
    setEditingSolicitud(null);
    setIsMemorandumMode(false);
    setSolicitudToViewInline(null);
    setCaseToAssignAforador(null);
  }, []);

  useEffect(() => {
    const authUserChanged = authUser?.uid !== internalUser?.uid || (authUser && !internalUser) || (!authUser && internalUser);
    if (authUserChanged) {
      resetApp();
      setInternalUser(authUser);
    }
  }, [authUser, internalUser, resetApp]);
  
  const setInitialContextData = useCallback((data: InitialDataContext) => {
    setInitialContextDataState(data);
  }, []);

  const addSolicitud = useCallback((solicitud: Omit<SolicitudData, 'id'>) => {
    if (!initialContextData?.ne) {
        console.error("No se puede generar ID de solicitud: falta el NE en el contexto inicial.");
        toast({
            title: "Error Interno",
            description: "No se pudo generar un ID para la solicitud porque falta el NE.",
            variant: "destructive",
        });
        return;
    }
    const now = new Date();
    // NE-DDMMYY-HHMMSS
    const formattedDate = format(now, "ddMMyy-HHmmss");
    const newId = `${initialContextData.ne}-${formattedDate}`;
    
    const newSolicitud = { ...solicitud, id: newId };
    setSolicitudes(prev => [...prev, newSolicitud]);
  }, [initialContextData, toast]);

  const updateSolicitud = useCallback((solicitud: SolicitudData) => {
    setSolicitudes(prev => prev.map(s => s.id === solicitud.id ? solicitud : s));
  }, []);

  const deleteSolicitud = useCallback((solicitudId: string) => {
    setSolicitudes(prev => prev.filter(s => s.id !== solicitudId));
  }, []);

  const openSolicitudModal = useCallback((solicitud?: SolicitudData) => {
    setEditingSolicitud(solicitud || null);
    setIsAddProductModalOpen(true);
  }, []);


  const logAuditEvent = useCallback(async (action: AuditLogEntry['action'], details: AuditLogEntry['details']) => {
    if (!isRecoveryMode || !examData?.ne || !authUser?.email) return;

    try {
      const auditLogRef = collection(db, "examenesRecuperados");
      const logEntry: Omit<AuditLogEntry, 'id'> = {
        examNe: examData.ne,
        action: action,
        changedBy: authUser.email,
        changedAt: Timestamp.fromDate(new Date()),
        details: details
      };
      await addDoc(auditLogRef, logEntry);
    } catch (error) {
      console.error("Error writing audit log:", error);
      toast({
        title: "Error de Auditoría",
        description: "No se pudo registrar el cambio en la bitácora de recuperación.",
        variant: "destructive"
      });
    }
  }, [isRecoveryMode, examData?.ne, authUser?.email, toast]);
  
  const softSaveExam = useCallback(async (currentExamData: ExamData | null, currentProducts: Product[]) => {
      if (!currentExamData?.ne || !authUser?.email) {
          console.log("Soft save prerequisites not met.", {ne: currentExamData?.ne, user: authUser?.email})
          return; // Don't save if there's no NE or user
      }
  
      const examDocRef = doc(db, "examenesPrevios", currentExamData.ne.toUpperCase());
  
      const dataToSave: Partial<ExamDocument> = {
          ...currentExamData,
          products: currentProducts,
          savedBy: authUser.email,
          status: 'incomplete', // Add a status field
          lastUpdated: Timestamp.fromDate(new Date()),
      };
      
      try {
          const docSnap = await getDoc(examDocRef);
          
          // Set createdAt timestamp only when the FIRST product is added
          if (currentProducts.length === 1 && (!docSnap.exists() || !docSnap.data().createdAt)) {
              dataToSave.createdAt = Timestamp.fromDate(new Date());
          }

          // Always update savedAt timestamp for any save
          dataToSave.savedAt = Timestamp.fromDate(new Date());

          await setDoc(examDocRef, dataToSave, { merge: true });
          console.log(`Soft save successful for NE: ${currentExamData.ne}`);
      } catch (error) {
          console.error("Error during soft save:", error);
          toast({
              title: "Error de Autoguardado",
              description: "No se pudo guardar el progreso. Revisa tu conexión.",
              variant: "destructive"
          });
      }
  }, [authUser, toast]);

  const setExamData = useCallback((data: ExamData, isRecovery: boolean = false) => {
    setExamDataState(data);
    if (isRecovery) {
      setIsRecoveryMode(true);
    }
  }, []);
  
  const setProducts = useCallback((products: Product[]) => {
    setProductsState(products);
  }, []);

  const addProduct = useCallback((productData: Omit<Product, 'id'>) => {
    const newProduct: Product = { 
        ...productData, 
        id: uuidv4(),
        productTimestampSaveAt: Timestamp.fromDate(new Date()),
    };
    setProductsState((prevProducts) => {
        const newProducts = [...prevProducts, newProduct];
        softSaveExam(examData, newProducts);
        return newProducts;
    });
    logAuditEvent('product_added', {
        productId: newProduct.id,
        newData: newProduct
    });
  }, [examData, softSaveExam, logAuditEvent]);

  const updateProduct = useCallback((updatedProduct: Product) => {
    let previousData: Product | undefined;
    setProductsState((prevProducts) => {
        previousData = prevProducts.find(p => p.id === updatedProduct.id);
        const newProducts = prevProducts.map((p) => (p.id === updatedProduct.id ? updatedProduct : p));
        softSaveExam(examData, newProducts);
        return newProducts;
    });
    logAuditEvent('product_updated', {
        productId: updatedProduct.id,
        previousData: previousData,
        newData: updatedProduct
    });
    setEditingProductState(null);
  }, [examData, softSaveExam, logAuditEvent]);

  const deleteProduct = useCallback((productId: string) => {
    let deletedProduct: Product | undefined;
    setProductsState((prevProducts) => {
        deletedProduct = prevProducts.find(p => p.id === productId);
        const newProducts = prevProducts.filter((p) => p.id !== productId);
        softSaveExam(examData, newProducts);
        return newProducts;
    });
     if (deletedProduct) {
        logAuditEvent('product_deleted', {
            productId: productId,
            previousData: deletedProduct
        });
    }
  }, [examData, softSaveExam, logAuditEvent]);

  const setCurrentStep = useCallback((step: ExamStep) => {
    setCurrentStepState(step);
  }, []);
  
  const setEditingProduct = useCallback((product: Product | null) => {
    setEditingProductState(product);
  }, []);

  const openAddProductModal = useCallback((itemToEdit?: Product | SolicitudData | null) => {
    if (currentStep === ExamStep.PRODUCT_LIST) {
        setEditingProductState(itemToEdit as Product | null);
    } else if (currentStep === ExamStep.SOLICITUD_LIST) {
        setEditingSolicitud(itemToEdit as SolicitudData | null);
    }
    setIsAddProductModalOpen(true);
  }, [currentStep]);

  const closeAddProductModal = useCallback(() => {
    setIsAddProductModalOpen(false);
    setEditingProductState(null);
    setEditingSolicitud(null);
  }, []);

  const openProductDetailModal = useCallback((product: Product) => {
    setProductToView(product);
    setIsProductDetailModalOpen(true);
  }, []);

  const closeProductDetailModal = useCallback(() => {
    setIsProductDetailModalOpen(false);
    setProductToView(null);
  }, []);

  const toggleProductSelection = useCallback((productId: string) => {
    setSelectedProducts(prev => 
        prev.includes(productId) 
            ? prev.filter(id => id !== productId)
            : [...prev, productId]
    );
  }, []);

  const toggleSelectAllProducts = useCallback(() => {
    if (selectedProducts.length === products.length) {
        setSelectedProducts([]);
    } else {
        setSelectedProducts(products.map(p => p.id));
    }
  }, [products, selectedProducts.length]);

  const deleteSelectedProducts = useCallback(() => {
    const deletedProducts: Product[] = [];
    setProductsState(prev => {
        const remainingProducts = prev.filter(p => {
            if (selectedProducts.includes(p.id)) {
                deletedProducts.push(p);
                return false;
            }
            return true;
        });
        softSaveExam(examData, remainingProducts);
        return remainingProducts;
    });

    deletedProducts.forEach(deletedProduct => {
        logAuditEvent('product_deleted', {
            productId: deletedProduct.id,
            previousData: deletedProduct
        });
    });
    
    setSelectedProducts([]);
    toast({
        title: "Productos eliminados",
        description: `${deletedProducts.length} productos han sido eliminados de la lista.`
    })
  }, [selectedProducts, softSaveExam, examData, logAuditEvent, toast]);

  return (
    <AppContext.Provider
      value={{
        examData,
        products,
        currentStep,
        editingProduct,
        isAddProductModalOpen,
        isProductDetailModalOpen,
        productToView,
        selectedProducts,
        setExamData,
        setProducts,
        addProduct,
        updateProduct,
        deleteProduct,
        setCurrentStep,
        setEditingProduct,
        openAddProductModal,
        closeAddProductModal,
        openProductDetailModal,
        closeProductDetailModal,
        resetApp,
        softSaveExam,
        toggleProductSelection,
        toggleSelectAllProducts,
        deleteSelectedProducts,

        // For examinerPay flow
        initialContextData,
        setInitialContextData,
        solicitudes,
        addSolicitud,
        updateSolicitud,
        deleteSolicitud,
        editingSolicitud,
        openSolicitudModal,
        isMemorandumMode,
        setIsMemorandumMode,
        solicitudToViewInline,
        setSolicitudToViewInline,

        // For PSMT flow
        caseToAssignAforador,
        setCaseToAssignAforador,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
