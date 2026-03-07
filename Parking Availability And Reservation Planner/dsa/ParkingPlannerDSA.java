import java.util.*;

public class ParkingPlannerDSA {

    // CO2: Array used to store parking slots
    static String[] slots = {
        "A01", "A02", "A03", "A04",
        "B01", "B02", "B03", "B04"
    };

    static String[] status = {
        "Available","Occupied","Available","Reserved",
        "Available","Occupied","Available","Available"
    };

    // CO4: HashMap for quick slot lookup
    static HashMap<String,String> slotMap = new HashMap<>();

    // CO3: Queue for waiting vehicles
    static Queue<String> waitingQueue = new LinkedList<>();

    // CO3: Stack for reservation history
    static Stack<String> reservationStack = new Stack<>();


    public static void main(String[] args) {

        Scanner sc = new Scanner(System.in);

        // Fill hashmap
        for(int i=0;i<slots.length;i++){
            slotMap.put(slots[i], status[i]);
        }

        while(true){

            System.out.println("\n--- Parking Planner ---");
            System.out.println("1. Show Parking Slots");
            System.out.println("2. Reserve Slot");
            System.out.println("3. Occupy Slot");
            System.out.println("4. Free Slot");
            System.out.println("5. Search Slot");
            System.out.println("6. Add Waiting Car");
            System.out.println("7. Show Waiting Queue");
            System.out.println("8. Show Reservation History");
            System.out.println("9. Exit");

            System.out.print("Enter choice: ");
            int choice = sc.nextInt();
            sc.nextLine();

            switch(choice){

                case 1:
                    showSlots();
                    break;

                case 2:
                    System.out.print("Enter slot to reserve: ");
                    String r = sc.nextLine();
                    reserveSlot(r);
                    break;

                case 3:
                    System.out.print("Enter slot to occupy: ");
                    String o = sc.nextLine();
                    occupySlot(o);
                    break;

                case 4:
                    System.out.print("Enter slot to free: ");
                    String f = sc.nextLine();
                    freeSlot(f);
                    break;

                case 5:
                    System.out.print("Enter slot to search: ");
                    String s = sc.nextLine();
                    searchSlot(s);
                    break;

                case 6:
                    System.out.print("Enter car number: ");
                    String car = sc.nextLine();
                    waitingQueue.add(car);
                    System.out.println("Car added to waiting queue");
                    break;

                case 7:
                    System.out.println("Waiting Cars: " + waitingQueue);
                    break;

                case 8:
                    System.out.println("Reservation History: " + reservationStack);
                    break;

                case 9:
                    System.out.println("Exiting...");
                    return;

                default:
                    System.out.println("Invalid choice");
            }

        }

    }


    // Show slots
    static void showSlots(){
        System.out.println("\nParking Slots:");
        for(int i=0;i<slots.length;i++){
            System.out.println(slots[i] + " - " + status[i]);
        }
    }


    // CO1: Linear Search
    static int findSlot(String slotID){
        for(int i=0;i<slots.length;i++){
            if(slots[i].equalsIgnoreCase(slotID)){
                return i;
            }
        }
        return -1;
    }


    // Reserve slot
    static void reserveSlot(String slotID){

        int index = findSlot(slotID);

        if(index == -1){
            System.out.println("Slot not found");
            return;
        }

        if(status[index].equals("Available")){
            status[index] = "Reserved";
            reservationStack.push(slotID);
            slotMap.put(slotID,"Reserved");
            System.out.println("Slot reserved successfully");
        }
        else{
            System.out.println("Slot not available");
        }
    }


    // Occupy slot
    static void occupySlot(String slotID){

        int index = findSlot(slotID);

        if(index == -1){
            System.out.println("Slot not found");
            return;
        }

        status[index] = "Occupied";
        slotMap.put(slotID,"Occupied");
        System.out.println("Slot marked as occupied");
    }


    // Free slot
    static void freeSlot(String slotID){

        int index = findSlot(slotID);

        if(index == -1){
            System.out.println("Slot not found");
            return;
        }

        status[index] = "Available";
        slotMap.put(slotID,"Available");
        System.out.println("Slot is now available");

        // Assign waiting car
        if(!waitingQueue.isEmpty()){
            String nextCar = waitingQueue.remove();
            System.out.println("Next waiting car assigned: " + nextCar);
        }
    }


    // Search slot
    static void searchSlot(String slotID){

        if(slotMap.containsKey(slotID)){
            System.out.println("Slot " + slotID + " status: " + slotMap.get(slotID));
        }
        else{
            System.out.println("Slot not found");
        }

    }

}